// Piano listening (test version). Everything here runs on the device; no sound is
// recorded, saved or sent anywhere.
//
// The engine looks at the microphone's spectrum about 50 times a second:
//  - a new note shows up as a sudden rise across many pitches (an "onset");
//  - after each onset it watches the next ~150 ms. A piano note keeps the same
//    set of pitches and fades out; talking slides between pitches and swells.
//  - "seconds since the last piano note" drives the bored and asleep states.
// The thresholds are kept in TUNING so the test page can show them and we can
// adjust them after trying it on the real piano.

export const TUNING = {
  low: 80, high: 5000,      // Hz range the engine looks at
  gate: 9,                  // dB above the room's noise floor before a sound counts
  minLevel: -75,            // dB (full scale): anything quieter is silence
  fluxK: 2.2,               // how far above recent "change" an onset must be
  fluxMin: 2.5,             // dB, the smallest change that can be an onset
  refractory: 70,           // ms between two onsets
  judgeFrames: 10,          // frames watched after an onset (~200 ms at 20 ms a frame)
  settle: 3,                // skip the frames that still hold the sound before the onset
  lag: 3,                   // compare frames this far apart (~60 ms)
  steady: 0.75,             // pitch pattern similarity a piano note keeps
  grow: 2,                  // dB a sound may grow after its onset and still be a piano note
  boredAfter: 30,           // seconds without a piano note
  asleepAfter: 60,
};

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** "A4" for 440 Hz. */
export function noteName(hz) {
  if (!(hz > 0)) return '';
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function cosine(a, b) {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * A steady beat from the last few piano notes, or 0. Notes closer than 0.12 s are
 * one chord. Needs 4 gaps that agree within about 20%.
 */
export function steadyBpm(times) {
  const onsets = [];
  for (const t of times) if (!onsets.length || t - onsets[onsets.length - 1] > 120) onsets.push(t);
  const gaps = onsets.slice(1).map((t, i) => t - onsets[i]).slice(-6);
  if (gaps.length < 4) return 0;
  const mid = median(gaps);
  const spread = median(gaps.map((g) => Math.abs(g - mid)));
  if (!mid || spread / mid > 0.2 || mid > 2000) return 0;
  let bpm = 60000 / mid;
  while (bpm > 180) bpm /= 2;
  while (bpm < 60) bpm *= 2;
  return Math.round(bpm);
}

/** The buddy's state from seconds since the last piano note (heard: any note yet). */
export function buddyState(since, heard = true, tune = TUNING) {
  if (since >= tune.asleepAfter) return 'asleep';
  if (since >= tune.boredAfter) return 'bored';
  if (since < 4 && heard) return 'playing';
  return 'waiting';
}

/**
 * Listens to frames of a spectrum. Call frame(db, rmsDb, nowMs) with the analyser's
 * getFloatFrequencyData output (dB per bin) and the loudness of the same moment.
 * Returns the events that frame finished: { type: 'onset' } right away, then
 * { type: 'piano' | 'other', ... } once the note has been judged.
 */
export function createListener({ sampleRate, fftSize, tune = TUNING, start = 0 }) {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(tune.low / binHz));
  const hi = Math.min(fftSize / 2 - 1, Math.ceil(tune.high / binHz));
  const n = hi - lo;
  let prevLog = null;
  let floor = null;                 // the room's noise floor, in dB
  const fluxHist = [];              // recent flux values (about 1 s)
  let lastOnset = -1e9;
  let judging = null;               // the onset being judged
  const s = {
    start, lastPiano: null, pianoTimes: [], pianoNotes: 0, otherSounds: 0,
    level: -100, floor: -100, flux: 0, threshold: 0, note: '', bpm: 0, last: null,
  };

  function frame(db, rmsDb, now) {
    const events = [];
    const level = Number.isFinite(rmsDb) ? rmsDb : -100;
    // the noise floor drops at once and creeps up slowly (5 dB a second); digital
    // silence (the mic still starting up) doesn't count
    if (level > -100) {
      if (floor == null || level < floor) floor = level;
      else floor += Math.min(level - floor, 0.1);
    }
    const loud = floor != null && level > floor + tune.gate && level > tune.minLevel;

    // magnitudes above the floor in the band, and their log for "change"
    const mag = new Float32Array(n);
    const lg = new Float32Array(n);
    let peak = 0, peakBin = 0;
    for (let i = 0; i < n; i++) {
      const d = Number.isFinite(db[lo + i]) ? db[lo + i] : -140;
      lg[i] = Math.max(d, -100);
      mag[i] = 10 ** (d / 20);
      if (mag[i] > peak) { peak = mag[i]; peakBin = lo + i; }
    }
    let flux = 0;
    if (prevLog) {
      for (let i = 0; i < n; i++) { const up = lg[i] - prevLog[i]; if (up > 0) flux += up; }
      flux /= n;
    }
    prevLog = lg;
    const mean = fluxHist.length ? fluxHist.reduce((a, b) => a + b, 0) / fluxHist.length : 0;
    const threshold = Math.max(tune.fluxMin, mean * tune.fluxK);
    fluxHist.push(flux);
    if (fluxHist.length > 50) fluxHist.shift();

    const onset = loud && flux > threshold && now - lastOnset > tune.refractory;
    if (judging && onset) {
      // a new note before this one was fully judged (fast playing): judge it on what we have
      events.push(judge(judging));
      judging = null;
    }
    if (judging) {
      judging.frames.push({ mag, level });
      if (judging.frames.length >= tune.judgeFrames) {
        events.push(judge(judging));
        judging = null;
      }
    } else if (onset) {
      lastOnset = now;
      judging = { at: now, frames: [{ mag, level }], hz: peakBin * binHz };
      events.push({ type: 'onset', at: now });
    }

    Object.assign(s, { level, floor: floor ?? -100, flux, threshold, loud });
    if (loud) s.note = noteName(peakBin * binHz);
    return events;
  }

  function judge(j) {
    const f = j.frames;
    const sims = [];
    for (let i = tune.settle; i + tune.lag < f.length; i++) sims.push(cosine(f[i].mag, f[i + tune.lag].mag));
    const steady = sims.length ? Math.min(...sims) : null;
    const top = Math.max(...f.slice(0, 3).map((x) => x.level));
    const later = f.length > 3 ? Math.max(...f.slice(3).map((x) => x.level)) : top;
    const growth = later - top;
    // too short to judge (very fast notes): same kind as the sound just before it
    const piano = steady == null
      ? s.last?.type === 'piano' && j.at - s.last.at < 1000
      : steady >= tune.steady && growth <= tune.grow;
    const ev = { type: piano ? 'piano' : 'other', at: j.at, steady, growth, note: noteName(j.hz) };
    if (piano) {
      s.pianoNotes++;
      s.lastPiano = j.at;
      s.pianoTimes.push(j.at);
      if (s.pianoTimes.length > 16) s.pianoTimes.shift();
      s.bpm = steadyBpm(s.pianoTimes);
    } else {
      s.otherSounds++;
    }
    s.last = ev;
    return ev;
  }

  /** Seconds since the last piano note (or since listening started). */
  function since(now) {
    return Math.max(0, (now - (s.lastPiano ?? s.start)) / 1000);
  }

  return { frame, since, state: s, binHz, range: [lo, hi] };
}

/**
 * Opens the microphone with the voice filters off (they treat held piano notes as
 * noise) and feeds a listener. onFrame(listener, events, now) runs each frame.
 * Returns { stop, settings } where settings says which filters Chrome actually used.
 */
export async function startListening(onFrame, tune = TUNING) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  await ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);
  const db = new Float32Array(analyser.frequencyBinCount);
  const wave = new Float32Array(analyser.fftSize);
  const t0 = performance.now();
  const listener = createListener({ sampleRate: ctx.sampleRate, fftSize: analyser.fftSize, tune, start: t0 });
  const tick = () => {
    analyser.getFloatFrequencyData(db);
    analyser.getFloatTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const rmsDb = 10 * Math.log10(sum / wave.length || 1e-12);
    const now = performance.now();
    onFrame(listener, listener.frame(db, rmsDb, now), now);
  };
  const timer = setInterval(tick, 20);
  const track = stream.getAudioTracks()[0];
  return {
    listener,
    settings: track?.getSettings?.() || {},
    sampleRate: ctx.sampleRate,
    stop() {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}
