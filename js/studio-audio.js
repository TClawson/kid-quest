// The recording studio's sound arithmetic, kept apart from the screen so it can be tested:
// finding loud clicks in a recording (for the timing check), joining the microphone's
// blocks, cutting a take so it starts on its beat, making a take loud enough, cutting one
// loop's plan down to a stretch of time, and a little picture of a take's sound.
// Pure functions, no DOM and no sound: studio.js uses them.
//
// A take is recorded while the tablet's own speaker clicks the beat, so two things are done
// to it (makeTake): its timing is measured from the count-in clicks in that same recording,
// and the clicks are taken back out of it, by learning from the count-in what a click sounds
// like in this room and subtracting that on every beat.

export const SILENT = 0.015;     // a take whose loudest sample is under this heard nothing
export const TAKE_PEAK = 0.7;    // a take is made this loud at its loudest
export const MAX_GAIN = 10;      // but never turned up more than this

/**
 * The studio's metronome click. Its two notes sit between the piano's keys (a quarter tone
 * off), so a piano note is never quite the click's note, and the count-in and the clicks
 * during a take are equally loud, so the count-in shows exactly what to take out.
 */
export const CLICK = { first: 1710, other: 1141, len: 0.06, vol: 0.16 };

/** The loudest sample, as a number from 0 to 1. */
export function peakOf(samples) {
  let top = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const v = Math.abs(samples[i]);
    if (v > top) top = v;
  }
  return top;
}

/**
 * A take made loud enough: its loudest sample brought to `peak`, turned up by at most
 * `most` times (and turned down when it is too loud). Returns { samples (a new copy), gain }.
 */
export function normalise(samples, peak = TAKE_PEAK, most = MAX_GAIN) {
  const top = peakOf(samples);
  const gain = top > 0 ? Math.min(most, peak / top) : 1;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] * gain;
  return { samples: out, gain };
}

/**
 * The shape of the desk's safety net (a WaveShaper curve of `n` points for -1 to 1): sound
 * under `knee` passes untouched, and louder sound is bent over softly instead of cracking.
 * Unlike a compressor it adds no delay, so the clicks and the music stay together.
 */
export function softClip(n = 1025, knee = 0.6) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (2 * i) / (n - 1) - 1;
    const a = Math.abs(x);
    out[i] = Math.sign(x) * (a <= knee ? a : knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee)));
  }
  return out;
}

/**
 * The times (seconds from the start of `samples`) where something loud starts: a click
 * or a struck note. The sound is high-passed (so a hum doesn't count), turned into a
 * loudness line in 2 ms steps, and an onset is where it jumps well above the quiet
 * between the clicks. Two onsets are at least `gap` seconds apart.
 */
export function findOnsets(samples, rate, { gap = 0.15, cutoff = 1000 } = {}) {
  const win = Math.max(1, Math.round(rate * 0.002));
  const n = Math.floor(samples.length / win);
  if (n < 4) return [];
  // a first-order high-pass filter, then the loudest value of each 2 ms window
  const a = 1 / (1 + (2 * Math.PI * cutoff) / rate);
  const env = new Float32Array(n);
  let y = 0;
  let prev = samples[0] || 0;
  for (let w = 0; w < n; w += 1) {
    let top = 0;
    for (let i = w * win; i < (w + 1) * win; i += 1) {
      const x = samples[i];
      y = a * (y + x - prev);
      prev = x;
      const v = Math.abs(y);
      if (v > top) top = v;
    }
    env[w] = top;
  }
  // the noise floor is the quiet part (the 30th percentile); a click is far above it
  const sorted = Float32Array.from(env).sort();
  const floor = sorted[Math.floor(n * 0.3)];
  const loudest = sorted[n - 1];
  const level = Math.max(floor * 6, loudest * 0.3, 0.005);
  if (loudest < level) return [];
  const out = [];
  let last = -Infinity;
  for (let w = 1; w < n; w += 1) {
    if (env[w] >= level && env[w - 1] < level) {
      const t = (w * win) / rate;
      if (t - last >= gap) { out.push(t); last = t; }
    }
  }
  return out;
}

/**
 * The microphone's blocks ({ samples, end }: `end` is the audio clock's frame just after the
 * block) as one run of sound: { first (the frame of samples[0]), samples }. A block that
 * went missing leaves silence in its place.
 */
export function joinBlocks(blocks) {
  if (!blocks.length) return { first: 0, samples: new Float32Array(0) };
  const first = blocks[0].end - blocks[0].samples.length;
  const last = blocks.reduce((m, b) => Math.max(m, b.end), 0);
  const out = new Float32Array(Math.max(0, last - first));
  for (const b of blocks) {
    const at = b.end - b.samples.length - first;
    if (at >= 0) out.set(b.samples, at);
  }
  return { first, samples: out };
}

/**
 * Cut a take out of the microphone's sound so it lines up with the mix. What the kid played
 * along with at context time T arrives in the recording `delay` seconds later, so the take
 * for [from, to) (context times) is the recording's [from + delay, to + delay). Sound from
 * before the recording started is silence. Returns a Float32Array.
 */
export function alignTake(recording, rate, from, to, delay) {
  return cutFrames(recording, Math.round((from + delay) * rate), Math.round((to + delay) * rate));
}

/** The recording's frames [a, b) (audio clock frames); what wasn't recorded is silence. */
function cutFrames({ first, samples }, a, b) {
  const at = a - first;
  const out = new Float32Array(Math.max(0, b - a));
  for (let i = Math.max(0, -at); i < out.length && at + i < samples.length; i += 1) out[i] = samples[at + i];
  return out;
}

// ---------- the metronome click, and taking it back out of a take ----------

/**
 * When the metronome clicks for a recording, in whole audio clock frames. The count-in is a
 * bar of `meter` clicks from the frame `t0`, then the take starts and clicks `room` beats.
 * `firstBeat` is the mix's beat where the take starts, so the first beat of every bar gets
 * the high note. `beat` is in seconds. Returns { countIn: [{ frame, hz }], clicks, from }.
 */
export function clickPlan(t0, rate, beat, meter, room, firstBeat = 0) {
  const step = beat * rate;
  const countIn = Array.from({ length: meter }, (_, i) => ({ frame: Math.round(t0 + i * step), hz: i === 0 ? CLICK.first : CLICK.other }));
  const from = Math.round(t0 + meter * step);
  const clicks = Array.from({ length: room }, (_, i) => ({
    frame: Math.round(from + i * step),
    hz: (firstBeat + i) % meter === 0 ? CLICK.first : CLICK.other,
  }));
  return { countIn, clicks, from };
}

/** One click as numbers from -1 to 1: a short note that starts fast and dies away. */
export function clickWave(rate, hz, len = CLICK.len) {
  const n = Math.round(len * rate);
  const out = new Float32Array(n);
  const up = Math.max(1, Math.round(0.002 * rate));
  const down = Math.max(1, Math.round(0.004 * rate));
  for (let i = 0; i < n; i += 1) {
    const rise = i < up ? 0.5 - 0.5 * Math.cos((Math.PI * i) / up) : 1;
    const fall = Math.exp(-Math.max(0, i - up) / rate / 0.011);
    const end = i > n - down ? (n - i) / down : 1;
    out[i] = Math.sin((2 * Math.PI * hz * i) / rate) * rise * fall * end;
  }
  return out;
}

const energy = (x) => { let e = 0; for (let i = 0; i < x.length; i += 1) e += x[i] * x[i]; return e; };

/** How much of a sound sits around one note (a band-pass filter's output, squared and summed). */
function bandEnergy(x, rate, hz, q = 4) {
  const w = (2 * Math.PI * hz) / rate;
  const alpha = Math.sin(w) / (2 * q);
  const b0 = alpha / (1 + alpha);
  const a1 = (-2 * Math.cos(w)) / (1 + alpha);
  const a2 = (1 - alpha) / (1 + alpha);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0; let e = 0;
  for (let i = 0; i < x.length; i += 1) {
    const y = b0 * (x[i] - x2) - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    e += y * y;
  }
  return e;
}

/** A sound without its rumble (under `cutoff` Hz), not shifted in time: filtered there and back. */
function highpass(x, rate, cutoff) {
  const a = 1 / (1 + (2 * Math.PI * cutoff) / rate);
  const out = Float32Array.from(x);
  for (let pass = 0; pass < 2; pass += 1) {
    let y = 0;
    let prev = out[0] || 0;
    for (let i = 0; i < out.length; i += 1) {
      const v = out[i];
      y = a * (y + v - prev);
      prev = v;
      out[i] = y;
    }
    out.reverse();
  }
  return out;
}

/** How alike two sounds are, from -1 to 1 (1: the same shape). */
function alike(a, b) {
  let ab = 0;
  for (let i = 0; i < a.length; i += 1) ab += a[i] * b[i];
  const d = Math.sqrt(energy(a) * energy(b));
  return d > 0 ? ab / d : 0;
}

/**
 * How late the microphone hears the speaker: `clicks` are the times clicks were played and
 * `heard` the times something loud started in the recording, which was searched up to
 * `until` (all in seconds on the same clock). Every pair of a click and a later sound is a
 * guess at the delay. A guess is judged by the clicks it should have caught before `until`:
 * the one that explains the most clicks wins (a sound within `near` seconds of where the
 * click should arrive), then the one that leaves the fewest unexplained, then the smallest.
 * So a delay longer than the gap between two clicks is still told right: a guess one gap
 * too short expects a sound after the first click where there was none. At least `need`
 * clicks must be explained (by default three, and all but one of those it should have
 * caught). Returns seconds (0 to `most`), or null when it can't tell.
 */
export function echoDelay(clicks, heard, { until = Infinity, most = 0.6, near = 0.008, need = 0 } = {}) {
  let best = null;
  for (const c of clicks) {
    for (const h of heard) {
      const d = h - c;
      if (d < 0 || d > most) continue;
      let n = 0;
      let due = 0;
      let sum = 0;
      for (const k of clicks) {
        if (k + d > until - near) continue; // it would arrive after the search ended
        due += 1;
        let off = Infinity;
        for (const x of heard) if (Math.abs(x - k - d) < Math.abs(off)) off = x - k - d;
        if (Math.abs(off) <= near) { n += 1; sum += d + off; }
      }
      if (n < (need || Math.max(3, due - 1))) continue;
      const guess = { n, missed: due - n, delay: sum / n };
      const better = !best || guess.n > best.n || (guess.n === best.n && (guess.missed < best.missed
        || (guess.missed === best.missed && guess.delay < best.delay - near)));
      if (better) best = guess;
    }
  }
  return best ? Math.max(0, best.delay) : null;
}

/**
 * How late the microphone heard the count-in: the clicks were played at the frames
 * `countIn`, and the recording up to the frame `until` (where the take begins) is searched
 * for them. Seconds, or null when the clicks can't be told (headphones, a noisy room).
 */
export function countInDelay({ first, samples }, rate, countIn, until) {
  if (!countIn.length) return null;
  const a = Math.max(0, countIn[0] - Math.round(0.05 * rate) - first);
  const b = Math.min(samples.length, until - first);
  if (b - a < rate * 0.2) return null;
  const heard = findOnsets(samples.subarray(a, b), rate).map((t) => (first + a) / rate + t);
  return echoDelay(countIn.map((f) => f / rate), heard, { until: (first + b) / rate });
}

/**
 * What a click sounds like to the microphone in this room: the recording at the count-in
 * clicks of one note (`starts`: the frames they arrived), `pre` seconds before to `post`
 * after. With three or more the middle value of each sample is kept, so one spoiled click
 * (a cough) doesn't matter. Null when it isn't clearly a click: the count-in clicks don't
 * sound alike, it is too quiet, or most of the sound isn't the click's note (talking).
 */
function clickTemplate({ first, samples }, rate, starts, hz, pre, post) {
  const n = Math.round((pre + post) * rate);
  const p = Math.round(pre * rate);
  const shots = [];
  for (const s of starts) {
    const a = s - p - first;
    if (a >= 0 && a + n <= samples.length) shots.push(highpass(samples.subarray(a, a + n), rate, 150));
  }
  if (!shots.length) return null;
  let tpl = shots[0];
  if (shots.length > 1) {
    tpl = new Float32Array(n);
    const col = new Float64Array(shots.length);
    const mid = shots.length >> 1;
    for (let i = 0; i < n; i += 1) {
      for (let k = 0; k < shots.length; k += 1) col[k] = shots[k][i];
      col.sort();
      tpl[i] = shots.length % 2 ? col[mid] : (col[mid - 1] + col[mid]) / 2;
    }
    if (shots.filter((s) => alike(s, tpl) >= 0.7).length < 2) return null;
  }
  if (peakOf(tpl) < 0.003 || bandEnergy(tpl, rate, hz) < 0.5 * energy(tpl)) return null;
  // soft edges, so nothing is cut in sharply
  const head = Math.max(1, p >> 1);
  const tail = Math.max(1, Math.round(0.02 * rate));
  for (let i = 0; i < head; i += 1) tpl[i] *= i / head;
  for (let i = 0; i < tail; i += 1) tpl[n - 1 - i] *= i / tail;
  return tpl;
}

/**
 * Take the clicks out of the recording (in place). `clicks` are in the order they were
 * played: [{ start (the frame it arrived), tpl (what the count-in showed that click to be) }].
 * Each click first says how much of what was learned is really there (its fit: 1 is just
 * like the count-in, 0 is nothing like it). That much is subtracted, held close to what the
 * clicks around it say (the middle of seven), because a piano note on the beat can fool one
 * click but not its neighbours, and never more than twice its own fit, which is the most
 * that still leaves the recording quieter than before. So a microphone that turns itself
 * down, a lost bit of sound or a moved tablet can't make a click louder: at worst the
 * click stays. Returns how many clicks had something taken out.
 */
function takeClicksOut({ first, samples }, rate, clicks, pre) {
  const p = Math.round(pre * rate);
  const least = p + Math.round(0.02 * rate);
  const spots = [];
  for (const c of clicks) {
    const a = c.start - p - first;
    const n = Math.min(c.tpl.length, samples.length - a);
    if (a < 0 || n < least) continue;
    let d = 0;
    let tt = 0;
    for (let i = 0; i < n; i += 1) { d += samples[a + i] * c.tpl[i]; tt += c.tpl[i] * c.tpl[i]; }
    spots.push({ a, n, tpl: c.tpl, fit: tt > 0 ? d / tt : 0 });
  }
  let done = 0;
  spots.forEach((s, k) => {
    const around = spots.slice(Math.max(0, k - 3), k + 4).map((x) => x.fit).sort((x, y) => x - y);
    const usual = Math.max(0, Math.min(1.3, around[around.length >> 1]));
    const scale = Math.min(Math.max(s.fit, usual - 0.25), usual + 0.25, 2 * Math.max(0, s.fit));
    if (!(scale > 0.02)) return;
    for (let i = 0; i < s.n; i += 1) samples[s.a + i] -= scale * s.tpl[i];
    done += 1;
  });
  return done;
}

/**
 * A take out of the microphone's recording: lined up with the mix, and without the
 * metronome's clicks. `plan` says what was played, in audio clock frames:
 *   countIn: [{ frame, hz }]  the count-in clicks before the take,
 *   clicks:  [{ frame, hz }]  the clicks during the take (equally loud),
 *   from, to: the take's first frame and the frame after its last,
 *   guess: how late the microphone is (seconds) when the count-in can't tell,
 *   phones: the kid wears headphones (the microphone doesn't hear the clicks),
 *   lead: seconds of sound kept from before `from`, so a note played a little early
 *         keeps its start (the take's beat is then `lead` seconds into the samples).
 * Returns { samples, delay (seconds, the one used), measured (it came from this recording's
 * count-in), cleaned (how many clicks had something taken out), played (whether anything
 * but the clicks is in the take: false means the kid played nothing) }.
 */
export function makeTake(recording, { rate, countIn, clicks, from, to, guess, phones = false, lead = 0, pre = 0.01, post = 0.15 }) {
  const heard = countInDelay(recording, rate, countIn.map((c) => c.frame), from);
  const measured = heard != null;
  const delay = measured ? heard : guess;
  const d = Math.round(delay * rate);
  const during = clicks.filter((c) => c.frame < to);
  let rec = recording;
  let cleaned = 0;
  let known = false; // every click in the take was learned from the count-in
  let clickPeak = 0;
  if (measured) {
    rec = { first: recording.first, samples: Float32Array.from(recording.samples) };
    const learned = new Map();
    for (const hz of new Set(during.map((c) => c.hz))) {
      learned.set(hz, clickTemplate(recording, rate, countIn.filter((c) => c.hz === hz).map((c) => c.frame + d), hz, pre, post));
    }
    const list = during.filter((c) => learned.get(c.hz)).map((c) => ({ start: c.frame + d, tpl: learned.get(c.hz) }));
    cleaned = takeClicksOut(rec, rate, list, pre);
    known = during.length > 0 && list.length === during.length;
    for (const tpl of learned.values()) if (tpl) clickPeak = Math.max(clickPeak, peakOf(tpl));
  }
  const early = Math.round(lead * rate);
  const samples = cutFrames(rec, from - early + d, to + d);
  // Was anything played? With headphones there are no clicks in the take, so any sound
  // counts. Otherwise sound away from the clicks counts, and on a click (a short note
  // right on the beat) only when the click was taken out and what is left is still as
  // loud as half a click.
  const times = during.map((c) => (c.frame - from + early) / rate);
  let played = peakAway(samples, rate, times) >= SILENT;
  if (!played && phones && !measured) played = peakOf(samples) >= SILENT;
  if (!played && known) played = peakOf(samples) >= Math.max(SILENT, 0.5 * clickPeak);
  return { samples, delay, measured, cleaned, played };
}

/**
 * The loudest sample of a take away from the metronome's clicks (`times`: seconds into the
 * take where a click arrived), to tell whether anything was played at all.
 */
export function peakAway(samples, rate, times, pad = 0.17, lead = 0.012) {
  const marks = times.map((t) => [Math.round((t - lead) * rate), Math.round((t + pad) * rate)]).sort((x, y) => x[0] - y[0]);
  let top = 0;
  let k = 0;
  for (let i = 0; i < samples.length; i += 1) {
    while (k < marks.length && i >= marks[k][1]) k += 1;
    if (k < marks.length && i >= marks[k][0]) { i = marks[k][1] - 1; continue; }
    const v = Math.abs(samples[i]);
    if (v > top) top = v;
  }
  return top;
}

/**
 * How late the microphone is when the kid wears headphones, from what was measured through
 * the speaker: the speaker's own lateness then (`outThen`) is swapped for the headphones'
 * now (`outNow`). All in seconds.
 */
export function phonesDelay(measured, outThen, outNow) {
  return Math.max(0, Math.min(0.6, measured - (outThen || 0) + (outNow || 0)));
}

/** How late the microphone hears the speaker when no timing check has been done: a guess. */
export function guessDelay(outputLatency, baseLatency) {
  return (outputLatency || baseLatency || 0) + 0.03;
}

/**
 * One loop's plan (studiorules.js schedule) cut down to the stretch [from, to) of the loop
 * (seconds): a clip that starts before `from` starts there, later into its sound; one that
 * goes past `to` stops there. Clips outside the stretch are left out.
 */
export function sliceSchedule(plan, from, to = Infinity) {
  const out = [];
  for (const e of plan) {
    const start = Math.max(e.at, from);
    const end = Math.min(e.at + e.dur, to);
    if (end - start < 0.01) continue;
    out.push({ ...e, at: start, offset: e.offset + (start - e.at), dur: end - start });
  }
  return out;
}

/** Where a beat sits on the timeline, as a percent of the loop. */
export const pct = (beat, beats) => Math.round((beat / beats) * 10000) / 100;

/** The beat under a point x pixels into a timeline `width` wide with `beats` beats (whole beats). */
export function beatAt(x, width, beats) {
  if (!(width > 0)) return 0;
  return Math.max(0, Math.min(beats - 1, Math.floor((x / width) * beats)));
}

/**
 * A take's loudness as `points` numbers from 0 to 1, for a little picture of it: the
 * stretch [from, from + len) seconds of the sound.
 */
export function waveLine(samples, rate, from, len, points = 48) {
  const out = [];
  const a = Math.max(0, Math.round(from * rate));
  const b = Math.min(samples.length, Math.round((from + len) * rate));
  const step = Math.max(1, Math.floor((b - a) / points));
  for (let p = 0; p < points; p += 1) {
    let top = 0;
    const s = a + p * step;
    // look at up to 64 samples a point, enough for a picture
    const hop = Math.max(1, Math.floor(step / 64));
    for (let i = s; i < Math.min(b, s + step); i += hop) top = Math.max(top, Math.abs(samples[i]));
    out.push(Math.min(1, top));
  }
  return out;
}

/**
 * How many of the timing check's clicks were heard: a click counts when something loud
 * starts after it and before the next one. A steady beep that isn't the clicks (another
 * metronome, a clock) only matches some of them, so the check asks for most.
 */
export function clicksHeard(clicks, heard) {
  let n = 0;
  clicks.forEach((c, i) => {
    const next = clicks[i + 1] ?? c + 0.5;
    if (heard.some((h) => h >= c - 0.005 && h < next - 0.005)) n += 1;
  });
  return n;
}
