// The recording studio's sound arithmetic (js/studio-audio.js): the click finder for the
// timing check, joining the microphone's blocks, lining a take up with its beat, making a
// take loud enough, and cutting one loop's plan to a stretch of time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SILENT, CLICK, fadeEnds, peakOf, MOST_DELAY, usableDelay, stopPoint, firstPass, normalise, findOnsets, joinBlocks, alignTake, guessDelay, sliceSchedule, pct, beatAt, waveLine,
  clickWave, countInDelay, echoDelay, makeTake, peakAway, phonesDelay, softClip, clickPlan,
} from '../js/studio-audio.js';
import { schedule, addPart, addTake, newMix } from '../js/studiorules.js';

const RATE = 48000;

/** Made-up recording: quiet hiss and hum, with short loud clicks at `times` (seconds). */
function recording(seconds, times, { loud = 0.5, hiss = 0.003, hum = 0.05 } = {}) {
  const out = new Float32Array(Math.round(seconds * RATE));
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let i = 0; i < out.length; i += 1) out[i] = rand() * hiss + Math.sin((2 * Math.PI * 50 * i) / RATE) * hum;
  for (const t of times) {
    const at = Math.round(t * RATE);
    // a click: a decaying burst of a high tone, 15 ms long
    for (let i = 0; i < RATE * 0.015 && at + i < out.length; i += 1) out[at + i] += Math.sin((2 * Math.PI * 2500 * i) / RATE) * loud * Math.exp(-i / (RATE * 0.004));
  }
  return out;
}

test('the click finder hears each click once, close to where it is', () => {
  const clicks = [0.4, 0.9, 1.4, 1.9, 2.4, 2.9, 3.4, 3.9];
  const heard = findOnsets(recording(4.5, clicks), RATE);
  assert.equal(heard.length, clicks.length, `heard ${heard.map((t) => t.toFixed(3))}`);
  heard.forEach((t, i) => assert.ok(Math.abs(t - clicks[i]) < 0.004, `click ${i}: ${t}`));
});

test('the click finder ignores a hum and a quiet room, and copes with a short or empty recording', () => {
  assert.deepEqual(findOnsets(recording(2, [], { hum: 0.3 }), RATE), [], 'a loud hum is not a click');
  assert.deepEqual(findOnsets(new Float32Array(RATE), RATE), [], 'silence');
  assert.deepEqual(findOnsets(new Float32Array(10), RATE), [], 'too short to tell');
  // quiet clicks still count when the room is quieter still
  assert.equal(findOnsets(recording(3, [0.5, 1.5, 2.5], { loud: 0.05, hum: 0.002, hiss: 0.0005 }), RATE).length, 3);
});

test('the timing check: clicks heard 120 ms late give a delay of 120 ms', () => {
  const start = 10; // the sound's clock when the recording began
  const clicks = Array.from({ length: 8 }, (_, i) => start + 0.4 + i * 0.5);
  const rec = recording(5, clicks.map((c) => c - start + 0.12));
  const heard = findOnsets(rec, RATE).map((t) => start + t);
  const delay = echoDelay(clicks, heard, { need: clicks.length - 2 });
  assert.ok(Math.abs(delay - 0.12) < 0.005, `delay ${delay}`);
  assert.equal(echoDelay(clicks, findOnsets(new Float32Array(RATE * 5), RATE), { need: clicks.length - 2 }), null, 'nothing heard: no answer');
});

test('blocks from the microphone join up by their frame stamps, with silence for a lost block', () => {
  const block = (end, v) => ({ samples: new Float32Array(4).fill(v), end });
  const joined = joinBlocks([block(104, 1), block(108, 2), block(116, 4)]);
  assert.equal(joined.first, 100);
  assert.deepEqual([...joined.samples], [1, 1, 1, 1, 2, 2, 2, 2, 0, 0, 0, 0, 4, 4, 4, 4]);
  assert.deepEqual(joinBlocks([]), { first: 0, samples: new Float32Array(0) });
});

test('a take is cut so it starts on its beat, after the round trip delay', () => {
  const rate = 100;
  const samples = Float32Array.from({ length: 300 }, (_, i) => i); // sample i is frame 1000 + i
  const cap = { first: 1000, samples };
  // the beat played at context time 10.5 s (frame 1050) is heard 0.2 s later (frame 1070)
  const take = alignTake(cap, rate, 10.5, 11.5, 0.2);
  assert.equal(take.length, 100);
  assert.equal(take[0], 70);
  assert.equal(take[99], 169);
  // starting before the recording began: silence first
  const early = alignTake(cap, rate, 9.8, 10.2, 0);
  assert.deepEqual([...early.slice(0, 20)], new Array(20).fill(0));
  assert.equal(early[20], 0);
  assert.equal(early[21], 1);
  // running past the end: silence at the end
  const late = alignTake(cap, rate, 12.9, 13.1, 0);
  assert.equal(late[9], 299);
  assert.equal(late[10], 0);
  assert.ok(Math.abs(guessDelay(0.05, 0.01) - 0.08) < 1e-9);
  assert.ok(Math.abs(guessDelay(undefined, 0.01) - 0.04) < 1e-9);
  assert.ok(Math.abs(guessDelay(undefined, undefined) - 0.03) < 1e-9);
});

test('a take is made loud enough, but never turned up more than 10 times', () => {
  const quiet = Float32Array.from([0, 0.1, -0.2, 0.05]);
  const { samples, gain } = normalise(quiet);
  assert.ok(Math.abs(peakOf(samples) - 0.7) < 1e-6);
  assert.ok(Math.abs(gain - 3.5) < 1e-6);
  assert.deepEqual([...quiet], [0, 0.1, -0.2, 0.05].map(Math.fround), 'the original is left alone');
  const faint = normalise(Float32Array.from([0.012, -0.005]));
  assert.equal(faint.gain, 10);
  assert.ok(Math.abs(peakOf(faint.samples) - 0.12) < 1e-6);
  assert.ok(normalise(Float32Array.from([0.9, -1])).gain < 1, 'too loud is turned down');
  assert.equal(normalise(new Float32Array(3)).gain, 1, 'silence stays silence');
  assert.ok(peakOf(Float32Array.from([0.004, -0.009])) < SILENT, 'a whisper counts as nothing heard');
});

test('one loop\'s plan cut to a stretch of time: from the middle of the loop, or up to a point', () => {
  const { mix } = addPart(newMix(), 0, 'bg-meadow', 'lead'); // 32 beats at its own speed
  const plan = schedule(addPart(mix, 1, 'bg-meadow', 'bass', 8).mix);
  const beat = 60 / mix.bpm;
  const from = sliceSchedule(plan, 10 * beat);
  assert.equal(from.length, 2);
  assert.ok(Math.abs(from[0].at - 10 * beat) < 1e-9 && Math.abs(from[0].offset - 10 * beat) < 1e-9, 'the tune starts 10 beats in');
  assert.ok(Math.abs(from[0].at + from[0].dur - plan[0].at - plan[0].dur) < 1e-9, 'and ends where it did');
  const upTo = sliceSchedule(plan, 0, 8 * beat);
  assert.equal(upTo.length, 1, 'the bass starts at beat 8: left out');
  assert.ok(Math.abs(upTo[0].dur - 8 * beat) < 1e-9);
  assert.deepEqual(sliceSchedule(plan, 1000), []);
});

test('timeline arithmetic: percents, the beat under a tap, and a take\'s little picture', () => {
  assert.equal(pct(8, 32), 25);
  assert.equal(pct(1, 3), 33.33);
  assert.equal(beatAt(0, 320, 32), 0);
  assert.equal(beatAt(15, 320, 32), 1);
  assert.equal(beatAt(320, 320, 32), 31, 'the very end is the last beat');
  assert.equal(beatAt(-5, 320, 32), 0);
  assert.equal(beatAt(5, 0, 32), 0);
  const wave = waveLine(Float32Array.from({ length: 1000 }, (_, i) => (i < 500 ? 0 : 0.5)), 100, 0, 10, 10);
  assert.equal(wave.length, 10);
  assert.deepEqual(wave, [0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5]);
});

test('the timing check wants most clicks heard, so a beep once a second does not fool it', () => {
  const clicks = Array.from({ length: 8 }, (_, i) => 1 + i * 0.5);
  const need = clicks.length - 2;
  assert.ok(Math.abs(echoDelay(clicks, clicks.map((c) => c + 0.1), { need }) - 0.1) < 1e-9);
  // a missed click and a stray noise still agree
  const some = [1.1, 1.6, 2.1, 2.35, 3.1, 3.6, 4.1];
  assert.ok(Math.abs(echoDelay(clicks, some, { need }) - 0.1) < 1e-9);
  assert.equal(echoDelay(clicks, [1.2, 2.2, 3.2, 4.2], { need }), null, 'a beep once a second matches only half');
  assert.equal(echoDelay(clicks, [], { need }), null);
});

test('a take gets soft ends: a short fade in and a longer fade out', () => {
  const rate = 1000;
  const ones = new Float32Array(200).fill(1);
  const out = fadeEnds(ones, rate, 0.01, 0.05);
  assert.equal(ones[0], 1, 'the take itself is not changed');
  assert.equal(out[0], 0);
  assert.ok(out[5] > 0.4 && out[5] < 0.6, 'half way in');
  assert.equal(out[10], 1);
  assert.equal(out[100], 1, 'the middle stays');
  assert.equal(out[199], 0);
  assert.ok(Math.abs(out[199 - 25] - 0.5) < 0.05, 'half way out');
  assert.equal(out[149], 1);
  // a take shorter than its fades is faded all the way, never made louder
  const tiny = fadeEnds(new Float32Array(6).fill(1), rate, 0.01, 0.05);
  assert.ok(tiny.every((v) => v >= 0 && v <= 1));
  assert.deepEqual([...fadeEnds(new Float32Array(0), rate)], []);
});

test('a take that keeps sound from before its beat starts early, and is cut on the first time round', () => {
  const mix = { ...newMix(), bpm: 120 };
  const beat = 0.5;
  const made = addTake(addTake(mix, 0, 'a', 4, 0, { lead: 0.06 }).mix, 1, 'b', 4, 4, { lead: 0.06 }).mix;
  const plan = schedule(made);
  const a = plan.find((e) => e.take === 'a');
  // the loop's first beat: the lead is lost the first time round (sliceSchedule from 0)
  const first = sliceSchedule(plan, 0).find((e) => e.take === 'a');
  assert.ok(Math.abs(first.at) < 1e-9 && Math.abs(first.offset - 0.06) < 1e-9 && Math.abs(first.dur - 4 * beat) < 1e-9);
  // later times round it starts before the loop does (at the end of the loop before)
  const later = sliceSchedule(plan, -Infinity).find((e) => e.take === 'a');
  assert.deepEqual([later.at, later.offset], [a.at, 0]);
  assert.ok(Math.abs(later.at + 0.06) < 1e-9);
  // played from the middle of a clip with a lead, it starts that far into the sound
  const mid = sliceSchedule(plan, 5 * beat).find((e) => e.take === 'b');
  assert.ok(Math.abs(mid.at - 5 * beat) < 1e-9 && Math.abs(mid.offset - (0.06 + beat)) < 1e-9);
});

// ---------- a take: timed from its own count-in, and without the metronome's clicks ----------

/** A made-up room: how a sound from the speaker reaches the microphone, `late` seconds on. */
function room(late, seed = 3) {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const taps = [[Math.round(late * RATE), 0.5]];
  for (let i = 0; i < 30; i += 1) {
    const after = 0.0005 + rand() * 0.08;
    taps.push([Math.round((late + after) * RATE), (rand() - 0.5) * 0.5 * Math.exp(-after / 0.025)]);
  }
  return taps;
}

/**
 * A made-up recording session at 100 beats a minute, four beats in a bar: a bar of count-in,
 * then `beats` beats of take. Returns the plan (frames), the recording with the clicks as
 * the microphone hears them, and the same recording without them (what the take should be).
 */
function session({ late = 0.118, beats = 8, clicksHeardByMic = true, piano = 0, talkOver = false, moved = false, hiss = 0.001, bpm = 100 } = {}) {
  const first = 480000;
  const beat = Math.round((60 / bpm) * RATE);
  const t0 = first + Math.round(0.4 * RATE);
  const from = t0 + 4 * beat;
  const to = from + beats * beat;
  const n = to - first + Math.round(0.5 * RATE);
  const countIn = [0, 1, 2, 3].map((i) => ({ frame: t0 + i * beat, hz: i === 0 ? CLICK.first : CLICK.other }));
  const clicks = Array.from({ length: beats }, (_, i) => ({ frame: from + i * beat, hz: i % 4 === 0 ? CLICK.first : CLICK.other }));
  const quiet = new Float32Array(n);
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  for (let i = 0; i < n; i += 1) quiet[i] = rand() * 2 * hiss;
  if (piano) {
    // a note on most beats and some between, a little early or late like a kid, with overtones
    const notes = [293.66, 440, 587.33, 349.23, 1174.66, 880, 261.63, 392];
    for (let k = 0; k < beats * 2; k += 1) {
      if (k % 2 && k % 3) continue;
      const at = from - first + Math.round(late * RATE) + Math.round((k / 2) * beat + (rand() * 0.06) * RATE);
      const hz = notes[k % notes.length];
      for (let i = 0; i < RATE * 0.9 && at + i < n; i += 1) {
        const t = i / RATE;
        const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.35);
        quiet[at + i] += piano * env * (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(2 * Math.PI * 2 * hz * t) + 0.3 * Math.sin(2 * Math.PI * 4 * hz * t)) / 1.8;
      }
    }
  }
  if (talkOver) {
    // somebody talks all through the count-in: loud, low, and not the same twice
    for (let i = t0 - first; i < from - first; i += 1) {
      const t = i / RATE;
      quiet[i] += 0.25 * Math.sin(2 * Math.PI * (180 + 60 * Math.sin(t * 9)) * t) * (0.6 + 0.4 * Math.sin(t * 23)) + rand() * 0.1;
    }
  }
  const withClicks = Float32Array.from(quiet);
  if (clicksHeardByMic) {
    const put = (list, taps) => {
      for (const c of list) {
        const wave = clickWave(RATE, c.hz);
        for (const [lag, gain] of taps) {
          const at = c.frame - first + lag;
          for (let i = 0; i < wave.length && at + i < n; i += 1) withClicks[at + i] += wave[i] * CLICK.vol * gain;
        }
      }
    };
    put(countIn, room(late));
    put(clicks, moved ? room(late + 0.004, 99) : room(late));
  }
  const plan = { rate: RATE, countIn, clicks, from, to, guess: 0.09 };
  const want = alignTake({ first, samples: quiet }, RATE, from / RATE, to / RATE, late);
  const dirty = alignTake({ first, samples: withClicks }, RATE, from / RATE, to / RATE, late);
  return { plan, recording: { first, samples: withClicks }, want, dirty };
}

/** How much louder a is than b, in decibels (by energy). */
function dbOver(a, b) {
  let ea = 0; let eb = 0;
  for (let i = 0; i < a.length; i += 1) { ea += a[i] * a[i]; eb += b[i] * b[i]; }
  return 10 * Math.log10(ea / eb);
}
const minus = (a, b) => a.map((v, i) => v - b[i]);

/** The take made from a session, shifted to where it should be, so it can be compared. */
function taken(s) {
  const got = makeTake(s.recording, s.plan);
  const shift = Math.round((got.delay - 0.118) * RATE);
  const samples = new Float32Array(s.want.length);
  for (let i = 0; i < samples.length; i += 1) samples[i] = got.samples[i - shift] || 0;
  return { ...got, lined: samples };
}

test('a click is a short note that starts and ends at nothing', () => {
  const c = clickWave(RATE, CLICK.other);
  assert.equal(c.length, Math.round(CLICK.len * RATE));
  assert.equal(c[0], 0);
  assert.ok(Math.abs(c[c.length - 1]) < 0.001);
  const top = peakOf(c);
  assert.ok(top > 0.8 && top <= 1, `peak ${top}`);
  assert.ok(peakOf(c.subarray(Math.round(0.05 * RATE))) < 0.02, 'it has died away by the end');
});

test('a take is timed from its own count-in', () => {
  for (const late of [0.045, 0.118, 0.21]) {
    const s = session({ late });
    const d = countInDelay(s.recording, RATE, s.plan.countIn.map((c) => c.frame), s.plan.from);
    assert.ok(Math.abs(d - late) < 0.004, `late ${late}: measured ${d}`);
  }
  const s = session({ piano: 0.3 });
  const got = makeTake(s.recording, s.plan);
  assert.equal(got.measured, true);
  assert.ok(Math.abs(got.delay - 0.118) < 0.004, `with a piano: ${got.delay}`);
  assert.equal(got.samples.length, s.want.length);
  // a little of what came before the beat can be kept, for a note played early
  const early = makeTake(s.recording, { ...s.plan, lead: 0.05 });
  assert.equal(early.samples.length, s.want.length + 0.05 * RATE);
  assert.deepEqual(early.samples.subarray(0.05 * RATE), got.samples, 'the beat is 50 ms into the take');
  assert.equal(early.played, true);
});

test('the metronome clicks are taken out of a quiet take', () => {
  const s = session();
  const got = taken(s);
  assert.equal(got.cleaned, 8, 'every click');
  const left = dbOver(minus(got.lined, s.want), minus(s.dirty, s.want));
  assert.ok(left < -20, `clicks left: ${left.toFixed(1)} dB`);
  assert.ok(peakOf(got.samples) < SILENT, 'and then nothing was played, so nothing is heard');
  assert.ok(peakOf(s.dirty) > SILENT, 'with the clicks in, the take would have counted as played');
});

test('the clicks are taken out under a piano too, and the piano is left as it was', () => {
  // under a soft piano nearly all of the click goes; under a loud one (which hides the click
  // anyway) most of it does, since each click is judged with the piano on top of it
  for (const [piano, most] of [[0.05, -20], [0.3, -6]]) {
    const s = session({ piano, beats: 16 });
    const got = taken(s);
    const left = dbOver(minus(got.lined, s.want), minus(s.dirty, s.want));
    assert.ok(left < most, `piano ${piano}: clicks left ${left.toFixed(1)} dB`);
    assert.ok(dbOver(minus(got.lined, s.want), s.want) < -20, 'the piano is nearly untouched');
    assert.equal(got.played, true);
  }
});

/** Each beat of a take: how loud what is left of the click is, next to the click left in (dB). */
function perClick(s, lined) {
  const beat = Math.round(0.6 * RATE);
  const out = [];
  for (let a = 0; a + beat <= s.want.length; a += beat) {
    const w = Math.round(0.2 * RATE);
    out.push(dbOver(minus(lined.subarray(a, a + w), s.want.subarray(a, a + w)), minus(s.dirty.subarray(a, a + w), s.want.subarray(a, a + w))));
  }
  return out;
}

test('a microphone that turns itself down, or loses a bit of sound, never makes a click louder', () => {
  // the microphone drops to a third of its loudness two beats into the take
  const s = session({ beats: 16, piano: 0.05 });
  const cut = s.plan.from - s.recording.first + Math.round(0.118 * RATE) + 2 * Math.round(0.6 * RATE) - 2000;
  const duck = (x, from) => { for (let i = from; i < x.length; i += 1) x[i] *= 0.33; };
  duck(s.recording.samples, cut);
  duck(s.want, cut - (s.plan.from - s.recording.first + Math.round(0.118 * RATE)));
  duck(s.dirty, cut - (s.plan.from - s.recording.first + Math.round(0.118 * RATE)));
  const got = taken(s);
  const each = perClick(s, got.lined);
  assert.ok(Math.max(...each) < 0.5, `no click is louder than before: ${each.map((d) => d.toFixed(0))}`);
  assert.ok(dbOver(minus(got.lined, s.want), minus(s.dirty, s.want)) < -10, 'and most of the clicks still go');

  // 10 ms of the recording is lost (silence) right on a click
  const lost = session({ beats: 8 });
  const at = lost.plan.from - lost.recording.first + Math.round(0.118 * RATE) + 3 * Math.round(0.6 * RATE);
  lost.recording.samples.fill(0, at, at + 480);
  lost.want.fill(0, 3 * Math.round(0.6 * RATE), 3 * Math.round(0.6 * RATE) + 480);
  lost.dirty.fill(0, 3 * Math.round(0.6 * RATE), 3 * Math.round(0.6 * RATE) + 480);
  const each2 = perClick(lost, taken(lost).lined);
  assert.ok(Math.max(...each2) < 0.5, `no click is louder than before: ${each2.map((d) => d.toFixed(0))}`);
});

test('the delay is told right even when it is longer than a beat', () => {
  const clicks = [10, 10.353, 10.706, 11.059]; // 170 beats a minute
  const echoes = (d) => clicks.map((c) => c + d);
  for (const d of [0.05, 0.2, 0.34]) assert.ok(Math.abs(echoDelay(clicks, echoes(d), { until: 11.412 }) - d) < 1e-6, `delay ${d}`);
  // longer than a beat: the last echo comes after the search ends, the other three decide
  for (const d of [0.36, 0.42]) assert.ok(Math.abs(echoDelay(clicks, echoes(d).filter((h) => h < 11.412), { until: 11.412 }) - d) < 1e-6, `delay ${d}`);
  // a cough among the echoes doesn't matter, and one missed echo is allowed
  assert.ok(Math.abs(echoDelay(clicks, [...echoes(0.12), 10.9].sort(), { until: 11.412 }) - 0.12) < 1e-6);
  assert.ok(Math.abs(echoDelay(clicks, echoes(0.12).slice(0, 3), { until: 11.412 }) - 0.12) < 1e-6);
  assert.equal(echoDelay(clicks, echoes(0.12).slice(0, 2), { until: 11.412 }), null, 'two echoes are too few');
  assert.equal(echoDelay(clicks, [10.1, 10.6, 10.83, 11.3], { until: 11.412 }), null, 'sounds that are not echoes');
  assert.equal(echoDelay(clicks, []), null);
  // the timing check: 8 clicks half a second apart, heard 550 ms late
  const eight = Array.from({ length: 8 }, (_, i) => 1 + i * 0.5);
  assert.ok(Math.abs(echoDelay(eight, eight.map((c) => c + 0.55), { need: 6 }) - 0.55) < 1e-6);
  // and in a whole take at a fast speed with a slow tablet
  for (const late of [0.36, 0.42]) {
    const s = session({ late, bpm: 170 });
    const got = makeTake(s.recording, s.plan);
    assert.ok(got.measured && Math.abs(got.delay - late) < 0.004, `late ${late}: ${got.delay}`);
  }
});

test('a short note right on the beat still counts as playing', () => {
  // nothing but 80 ms notes exactly on the clicks, about as loud as the clicks
  const s = session({ beats: 8 });
  const beat = Math.round(0.6 * RATE);
  const start = s.plan.from - s.recording.first + Math.round(0.118 * RATE);
  for (let k = 0; k < 8; k += 1) {
    for (let i = 0; i < 0.08 * RATE; i += 1) {
      s.recording.samples[start + k * beat + i] += 0.1 * Math.sin((2 * Math.PI * 523.25 * i) / RATE) * Math.min(1, i / 200) * Math.exp(-i / (RATE * 0.03));
    }
  }
  assert.equal(makeTake(s.recording, s.plan).played, true);
  assert.equal(makeTake(session({ beats: 8 }).recording, session({ beats: 8 }).plan).played, false, 'the clicks alone are not playing');
  // with headphones the microphone hears no clicks, so any sound is playing
  const phones = session({ clicksHeardByMic: false });
  const at = phones.plan.from - phones.recording.first + Math.round(0.09 * RATE) + 100;
  for (let i = 0; i < 0.05 * RATE; i += 1) phones.recording.samples[at + i] += 0.1 * Math.sin((2 * Math.PI * 440 * i) / RATE);
  assert.equal(makeTake(phones.recording, { ...phones.plan, phones: true }).played, true);
  assert.equal(makeTake(phones.recording, phones.plan).played, false, 'without the headphones switch, sound on a click is taken for the click');
});

test('nothing is taken out when the count-in can\'t be trusted', () => {
  // headphones: the microphone never hears the clicks, so the guess is used
  const phones = session({ clicksHeardByMic: false, piano: 0.3 });
  const a = makeTake(phones.recording, phones.plan);
  assert.equal(a.measured, false);
  assert.equal(a.delay, 0.09);
  assert.equal(a.cleaned, 0);
  assert.deepEqual(a.samples, alignTake(phones.recording, RATE, phones.plan.from / RATE, phones.plan.to / RATE, 0.09));
  // talking over the count-in: whatever it does, it doesn't make the clicks worse
  const talk = session({ talkOver: true });
  const b = makeTake(talk.recording, talk.plan);
  if (b.measured) {
    const shift = Math.round((b.delay - 0.118) * RATE);
    assert.ok(Math.abs(shift) < 0.004 * RATE);
    const lined = talk.want.map((_, i) => b.samples[i - shift] || 0);
    assert.ok(dbOver(minus(lined, talk.want), minus(talk.dirty, talk.want)) < 0.5, 'no worse than leaving them in');
  } else assert.equal(b.cleaned, 0);
  // the tablet was moved after the count-in: the clicks don't match what was learned
  const moved = session({ moved: true });
  const c = taken(moved);
  assert.ok(dbOver(minus(c.lined, moved.want), minus(moved.dirty, moved.want)) < 0.5, 'no worse than leaving them in');
});

test('whether anything was played is judged away from the clicks, and headphones get their own delay', () => {
  const take = new Float32Array(RATE * 2);
  for (const t of [0, 0.6, 1.2, 1.8]) for (let i = 0; i < 0.06 * RATE; i += 1) take[Math.round(t * RATE) + i] = 0.2;
  assert.equal(peakOf(take), Math.fround(0.2));
  assert.equal(peakAway(take, RATE, [0, 0.6, 1.2, 1.8]), 0);
  take[Math.round(0.9 * RATE)] = 0.4;
  assert.equal(peakAway(take, RATE, [0, 0.6, 1.2, 1.8]), Math.fround(0.4));
  take[Math.round(0.65 * RATE)] = 0.9; // on a click: not counted
  assert.equal(peakAway(take, RATE, [0, 0.6, 1.2, 1.8]), Math.fround(0.4));
  assert.equal(peakAway(take, RATE, []), Math.fround(0.9));
  // measured 120 ms through a speaker that was 40 ms late; headphones that are 180 ms late
  assert.ok(Math.abs(phonesDelay(0.12, 0.04, 0.18) - 0.26) < 1e-9);
  assert.equal(phonesDelay(0.12, 0, 0), 0.12);
  assert.equal(phonesDelay(0.05, 0.2, 0), 0);
});

test('the desk\'s safety net leaves normal sound alone and bends loud sound over softly', () => {
  const curve = softClip(1001, 0.6);
  const at = (x) => curve[Math.round((x + 1) * 500)];
  assert.equal(at(0), 0);
  for (const x of [0.1, 0.3, 0.6, -0.5]) assert.ok(Math.abs(at(x) - x) < 1e-6, `${x} passes untouched`);
  assert.ok(at(0.8) < 0.8 && at(0.8) > 0.75, `0.8 becomes ${at(0.8)}`);
  assert.ok(at(1) < 0.95 && at(1) > 0.85, `1 becomes ${at(1)}`);
  assert.equal(at(-1), -at(1));
  for (let i = 1; i < curve.length; i += 1) assert.ok(curve[i] > curve[i - 1], 'louder in is always louder out');
});

test('the recording\'s clicks sit on whole frames, with the high note on each bar\'s first beat', () => {
  const H = CLICK.first;
  const L = CLICK.other;
  // a four-beat mix at 100 beats a minute, recorded from beat 3 for 6 beats
  const t0 = Math.ceil(12.3456 * RATE);
  const four = clickPlan(t0, RATE, 0.6, 4, 6, 2);
  assert.deepEqual(four.countIn.map((c) => c.hz), [H, L, L, L]);
  assert.deepEqual(four.clicks.map((c) => c.hz), [L, L, H, L, L, L]);
  assert.equal(four.countIn[0].frame, t0);
  assert.equal(four.from, t0 + 4 * 28800);
  assert.deepEqual(four.clicks.map((c) => c.frame - four.from), [0, 1, 2, 3, 4, 5].map((i) => i * 28800));
  // a waltz at 130 beats a minute (a beat isn't a whole number of frames)
  const three = clickPlan(t0, 44100, 60 / 130, 3, 7, 0);
  assert.deepEqual(three.countIn.map((c) => c.hz), [H, L, L]);
  assert.deepEqual(three.clicks.map((c) => c.hz), [H, L, L, H, L, L, H]);
  for (const c of [...three.countIn, ...three.clicks, ...four.countIn, ...four.clicks]) assert.ok(Number.isInteger(c.frame), `${c.frame} is a whole frame`);
  assert.ok(Number.isInteger(three.from));
  // each click is counted from the start, so the steps never drift
  const step = (60 / 130) * 44100;
  three.clicks.forEach((c, i) => assert.ok(Math.abs(c.frame - (three.from + i * step)) <= 0.5));
  assert.ok(Math.abs(three.from - (t0 + 3 * step)) <= 0.5);
  // nothing to record: no take clicks, but still a count-in
  assert.equal(clickPlan(t0, RATE, 0.5, 4, 0).clicks.length, 0);
});

test('a delay the timing check keeps is a delay the studio uses: the same limit', () => {
  const clicks = Array.from({ length: 8 }, (_, i) => 1 + i * 0.5);
  const late = MOST_DELAY - 0.01;
  const found = echoDelay(clicks, clicks.map((c) => c + late), { need: clicks.length - 2 });
  assert.ok(Math.abs(found - late) < 1e-9, `the check finds ${found}`);
  assert.equal(usableDelay(found), found, 'and the studio uses it');
  assert.equal(usableDelay(0), 0);
  for (const bad of [MOST_DELAY + 0.01, -0.01, NaN, null, undefined]) assert.equal(usableDelay(bad), null, String(bad));
});

test('Stop: the take ends where the kid heard the finger land, less its own delay', () => {
  const beat = 0.5;
  // at = 10 (the take's beat), end = 18 (its room)
  assert.equal(stopPoint(13, 10, 18, beat, 0.08), 12.92);
  assert.equal(stopPoint(30, 10, 18, beat, 0.08), 18, 'never past the room');
  // within the first beat: cut at the tap all the same, not stretched to a whole beat
  assert.ok(Math.abs(stopPoint(10.3, 10, 18, beat, 0.08) - 10.22) < 1e-9);
  // less than a quarter of a beat: stopped before playing anything
  assert.equal(stopPoint(10.2, 10, 18, beat, 0.08), null);
  assert.equal(stopPoint(9.5, 10, 18, beat, 0.08), null);
});

test('the first time round keeps the lead of a take that starts just before play does', () => {
  let mix = { ...newMix(), bpm: 120 };
  mix = addTake(mix, 0, 'a', 8, 0, { lead: 0.06 }).mix;
  mix = addTake(mix, 1, 'b', 4, 4, { lead: 0.06 }).mix;
  mix = addPart(mix, 2, 'bg-meadow', 'bass', 0).mix;
  const plan = schedule(mix);
  const from0 = firstPass(plan, 0);
  const a = from0.find((e) => e.take === 'a');
  assert.ok(Math.abs(a.at + 0.06) < 1e-9 && a.offset === 0, 'take a starts with its lead');
  assert.equal(from0.find((e) => e.kind === 'part').at, 0, 'a part is not started early');
  assert.equal(from0.length, 3);
  // from beat 5 (2 s): take b's lead starts at 1.94 s; take a is cut there as usual
  const from2 = firstPass(plan, 2);
  const b = from2.find((e) => e.take === 'b');
  assert.ok(Math.abs(b.at - 1.94) < 1e-9 && b.offset === 0);
  const cut = from2.find((e) => e.take === 'a');
  assert.ok(Math.abs(cut.at - 2) < 1e-9 && Math.abs(cut.offset - 2.06) < 1e-9);
  // started in the middle of a take's lead window but well after it: just cut
  const late = firstPass(plan, 2.2).find((e) => e.take === 'b');
  assert.ok(Math.abs(late.at - 2.2) < 1e-9);
});
