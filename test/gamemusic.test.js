import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS } from '../js/songs.js';
import { LOOPS } from '../js/maploops.js';
import { fakeAudio } from './helpers/fake-audio.mjs';

// the music engine plays through the browser's AudioContext: give it one that writes the notes down
const { FakeAudioContext, played, contexts } = fakeAudio();
globalThis.window = { AudioContext: FakeAudioContext };
const { playPiece, startMusic, stopMusic, loopScore } = await import('../js/music.js');

const START = 0.15; // playPiece starts this long after the clock's time

/**
 * Play a piece from the songbook (as Listen on its easy page does) to its end. Returns its
 * notes, drums left out, as { midi, bar, step } (step: the eighth of the bar it starts in).
 */
async function hear(id) {
  for (const c of contexts) c.currentTime = 0;
  played.length = 0;
  const h = playPiece(id);
  // notes are scheduled a little ahead of the clock: move the clock past the end, and wait a turn
  contexts[0].currentTime = 1e6;
  await new Promise((resolve) => { setTimeout(resolve, 150); });
  h.stop();
  const place = (n) => {
    const s = (n.t - START) / h.step + 1e-6;
    return { midi: n.midi, bar: Math.floor(s / h.beat), step: Math.floor(s % h.beat) };
  };
  return {
    notes: played.filter((n) => !n.swept && !n.noise).map(place),
    drums: played.filter((n) => n.swept).map(place), // kicks and toms
    noise: played.filter((n) => n.noise).map(place), // snares and hats
    bars: h.steps / h.beat,
  };
}
const classes = (notes) => [...new Set(notes.map((n) => n.midi % 12))].sort((a, b) => a - b);

test('two chords in a bar: the bass and the arpeggio change with the chord', async () => {
  // Phoenix Fire, bar 4: F for two beats, then E. The tune there is C6 B5, then A5 G#5.
  const fire = await hear('show:bg-volcano');
  assert.equal(fire.bars, 5);
  const band = (from, to) => fire.notes.filter((n) => n.bar === 3 && n.step >= from && n.step < to && n.midi < 79);
  assert.deepEqual(classes(band(0, 4)), [0, 5, 9], 'F, A and C under the first half');
  assert.deepEqual(classes(band(4, 8)), [4, 8, 11], 'E, G sharp and B under the second half');
  assert.ok(band(4, 8).some((n) => n.midi === 52), 'the bass lands on E on beat 3');
  // Dragon King Fanfare, bar 2: F, then B flat
  const king = await hear('show:bg-castle');
  const under = (from, to) => king.notes.filter((n) => n.bar === 1 && n.step >= from && n.step < to && n.midi < 82);
  assert.deepEqual(classes(under(0, 4)), [0, 5, 9]);
  assert.deepEqual(classes(under(4, 8)), [2, 5, 10], 'B flat, D and F under the second half');
  // a bar with one chord is as it was: all of bar 3 of Phoenix Fire is G
  assert.deepEqual(classes(fire.notes.filter((n) => n.bar === 2 && n.midi < 79)), [2, 7, 11]);
});

test('Listen plays a closing bar after the loop: one held home chord, and no more', async () => {
  const waltz = await hear('bg-ocean');
  assert.equal(SONGS['bg-ocean'].lead.length, 16);
  assert.equal(waltz.bars, 17, 'the sixteen bars of the loop, and the closing bar');
  const last = waltz.notes.filter((n) => n.bar === 16);
  assert.ok(last.length >= 3 && last.every((n) => n.step === 0), 'everything in the closing bar starts on its first beat');
  assert.deepEqual(classes(last), [2, 5, 9], 'D minor');
  assert.ok(last.some((n) => n.midi === 74), 'the tune comes home to D');
  assert.equal(waltz.notes.filter((n) => n.bar > 16).length, 0);
  // the bar before is still the loop's last bar (A, leading back), with its arpeggio running
  assert.deepEqual(classes(waltz.notes.filter((n) => n.bar === 15)), [1, 4, 9]);
  assert.ok(waltz.notes.filter((n) => n.bar === 15).length > 10);
  // a song that already ends at home has no closing bar
  assert.equal((await hear('bg-meadow')).bars, 16);
});

test('the new arpeggios come in where they should', async () => {
  const count = (id, bar) => hear(id).then((r) => r.notes.filter((n) => n.bar === bar).length);
  // Golden Stars: bare for four bars (tune and bass), then the sparkle (16 quick notes a bar)
  assert.ok(await count('bg-galaxy', 3) < 10);
  assert.ok(await count('bg-galaxy', 4) >= 16);
  // Ghost Ship Shanty: its first arpeggio, from bar 2
  assert.ok(await count('show:bg-sunset', 0) < 14);
  assert.ok(await count('show:bg-sunset', 1) >= 16);
});

test('the closing bar leaves the loop\'s drums alone: the build and the fill stay where they were', async () => {
  // Lava Run: four drum patterns over the sixteen bars of the loop, a fill in bar 16
  const lava = await hear('bg-volcano');
  assert.equal(lava.bars, 17);
  const drums = (bar) => lava.drums.filter((n) => n.bar === bar).length;
  const noise = (bar) => lava.noise.filter((n) => n.bar === bar).length;
  assert.equal(drums(3), 3, 'bars 1 to 4: three kicks');
  assert.equal(noise(3), 6, '... two snares and four hats');
  assert.equal(noise(4), 10, 'bars 5 to 8: eight hats');
  assert.equal(drums(8), 5, 'bars 9 to 12: two toms more');
  assert.equal(drums(12), 7, 'bars 13 to 15: four kicks and three toms');
  assert.equal(drums(15), 6, 'bar 16 is the fill: a kick and five toms');
  assert.equal(noise(15), 8);
  assert.deepEqual([drums(16), noise(16)], [1, 1], 'the closing bar: one kick and one open hat');
});

test('the game\'s loop never plays the closing bar', async () => {
  // a 16-bar song with a closing bar on paper (Bubble Waltz has a long loop in the village now)
  const id = 'bg-space';
  assert.ok(SONGS[id].ending && !LOOPS[id]);
  const { beat = 8 } = SONGS[id];
  for (const c of contexts) c.currentTime = 0;
  played.length = 0;
  startMusic(id);
  const step = 60 / SONGS[id].bpm / 2;
  // two times round and a bit, scheduled at the next turn of the engine's clock
  contexts[0].currentTime = 0.1 + step * beat * 34;
  await new Promise((resolve) => { setTimeout(resolve, 150); });
  stopMusic();
  const notes = played.filter((n) => !n.swept && !n.noise).map((n) => {
    const k = Math.round(((n.t - 0.1) / step) * 100); // hundredths of an eighth from the start
    return { midi: n.midi, bar: Math.floor(k / (beat * 100)), at: k % (beat * 100) };
  });
  const bar = (b) => notes.filter((n) => n.bar === b).map((n) => `${n.at}:${n.midi}`).sort().join(' ');
  assert.ok(bar(0).length > 0 && bar(33).length > 0, 'it played all the way');
  assert.equal(bar(16), bar(0), 'after bar 16 comes bar 1 again, not a closing bar');
  assert.equal(bar(17), bar(1));
  assert.equal(bar(32), bar(0));
  assert.notEqual(bar(16), bar(15));
});

// ---------- the long village loops (maploops.js) ----------

/**
 * Play a theme's map music in the village for `seconds`. Returns everything it played, timed
 * from its first step: { midi, t, swept (a kick or a tom), noise (a snare or a hat) }.
 */
async function village(theme, seconds) {
  for (const c of contexts) c.currentTime = 0;
  played.length = 0;
  startMusic(theme);
  contexts[0].currentTime = 0.1 + seconds;
  await new Promise((resolve) => { setTimeout(resolve, 150); });
  stopMusic();
  return played.map((n) => ({ ...n, t: n.t - 0.1 }));
}

/** What a stretch of the music plays, as text, its times in hundredths of `unit` from `from`. */
function heardIn(sounds, from, len, unit) {
  return sounds.filter((n) => n.t > from - 1e-6 && n.t < from + len - 1e-6)
    .map((n) => `${Math.round(((n.t - from) / unit) * 100)}:${n.noise ? 'noise' : n.midi}${n.swept ? 'k' : ''}`).sort().join(' ');
}

test('every bar of the long loops fits its section', () => {
  assert.deepEqual(Object.keys(LOOPS).sort(), ['bg-meadow', 'bg-ocean']);
  for (const [id, song] of Object.entries(LOOPS)) {
    for (const sec of song.sections) {
      const beat = sec.beat || song.beat || 8;
      const n = sec.lead.length;
      for (const key of ['chords', 'lead2', 'inv']) if (sec[key]) assert.equal(sec[key].length, n, `${id} ${sec.name}: ${key}`);
      sec.lead.forEach((bar, k) => assert.equal(bar.split(' ').length, beat, `${id} ${sec.name} bar ${k + 1}`));
      (sec.lead2 || []).forEach((bar, k) => { if (bar) assert.equal(bar.split(' ').length, beat, `${id} ${sec.name} second voice, bar ${k + 1}`); });
      if (sec.inv) for (const v of sec.inv) assert.ok([0, 1, 2].includes(Array.isArray(v) ? v[0] : v));
    }
    assert.equal(loopScore(id).length, song.sections.reduce((a, s) => a + s.lead.length, 0));
  }
  assert.equal(loopScore('bg-ocean').length, 49);
  assert.equal(loopScore('bg-meadow').length, 62);
  assert.equal(loopScore('bg-space'), null);
});

test('Bubble Waltz in the village: the waltz, the lullaby, the full current, then round again', async () => {
  const step = 60 / LOOPS['bg-ocean'].bpm / 2;
  const L = 6 * step; // every bar is a waltz bar of six eighths
  const sounds = await village('bg-ocean', 51 * L);
  const bar = (b) => heardIn(sounds, b * L, L, step);
  for (let b = 0; b <= 50; b += 1) assert.ok(bar(b).length > 0, `bar ${b + 1} plays`);
  // the lullaby (bars 17 to 33): no drums at all, the waltz around it has its kick every bar
  const kicks = (b) => sounds.filter((n) => n.swept && n.t > b * L - 1e-6 && n.t < (b + 1) * L - 1e-6).length;
  for (let b = 16; b < 33; b += 1) assert.equal(kicks(b) + sounds.filter((n) => n.noise && n.t > b * L - 1e-6 && n.t < (b + 1) * L - 1e-6).length, 0, `lullaby bar ${b - 15}: no drums`);
  assert.equal(kicks(15), 1);
  assert.equal(kicks(33), 1);
  // its bass walks G A Ab G F# G under bars 3 to 8
  const bass = (b) => Math.min(...sounds.filter((n) => !n.swept && !n.noise && Math.abs(n.t - b * L) < 1e-6).map((n) => n.midi));
  assert.deepEqual([18, 19, 20, 21, 22, 23].map(bass), [43, 45, 44, 43, 42, 43]);
  // after bar 49 comes bar 1 again, on time: no gap, no bar twice
  assert.equal(bar(49), bar(0));
  assert.equal(bar(50), bar(1));
  assert.notEqual(bar(48), bar(0));
  assert.notEqual(bar(33), bar(0), 'the full current is not the plain waltz');
});

test('Forest Village in the village: the Great Oak sways in two in a village bar, and the loop is 62 bars', async () => {
  const eighth = 60 / LOOPS['bg-meadow'].bpm / 2;
  const L = 8 * eighth;
  const score = loopScore('bg-meadow');
  assert.equal(score.length, 62);
  const oak = score.filter((b) => b.sec.name === 'The Great Oak');
  assert.equal(oak.length, 16);
  for (const b of oak) {
    assert.equal(b.beat, 6, 'six steps a bar');
    assert.ok(Math.abs(b.beat * b.step - L) < 1e-9, 'as long as a village bar');
  }
  const first = score.indexOf(oak[0]);
  assert.equal(first, 22);
  const sounds = await village('bg-meadow', 63 * L);
  // the Oak's first bar: F4 A4 D5 C5 on its steps 1, 3, 4 and 6 (of six), over everything lower
  const sway = L / 6;
  const tune = heardIn(sounds.filter((n) => !n.noise && n.midi >= 60), first * L, L, sway);
  assert.equal(tune, ['0:65', '200:69', '300:74', '500:72'].sort().join(' '));
  // everything in the swaying bars (the Oak and the bar before it) falls on their six steps;
  // everything else on the village's eighths (or the arpeggio's halves)
  for (const n of sounds) {
    const b = Math.floor(n.t / L + 1e-6) % 62;
    const unit = score[b].beat === 6 ? sway : eighth / 2;
    const at = (n.t - Math.floor(n.t / L + 1e-6) * L) / unit;
    assert.ok(Math.abs(at - Math.round(at)) < 1e-6, `bar ${b + 1}: ${n.t}`);
  }
  // and the next section starts right after the Oak's last bar: waking up, G4 under D4
  const wake = heardIn(sounds.filter((n) => !n.noise && Math.abs(n.t - 38 * L) < 1e-6), 38 * L, L, eighth);
  assert.ok(wake.includes('0:67') && wake.includes('0:62'), wake);
  // after bar 62 comes bar 1 again, on time
  assert.equal(heardIn(sounds, 62 * L, L, eighth), heardIn(sounds, 0, L, eighth));
  assert.notEqual(heardIn(sounds, 61 * L, L, eighth), heardIn(sounds, 0, L, eighth));
});

test('a theme without a long loop still plays its 16-bar song in the village', async () => {
  for (const id of ['bg-castle', 'bg-sunset']) {
    assert.ok(!LOOPS[id]);
    const song = SONGS[id];
    const beat = song.beat || 8;
    const step = 60 / song.bpm / 2;
    const L = beat * step;
    const sounds = (await village(id, 17 * L)).filter((n) => !n.noise && !n.swept);
    // the first bar's tune, at the first bar's steps (swing moves every second eighth a bit)
    const first = song.lead[0].split(' ').map((tok, i) => (tok === '-' || tok === '.' ? null : i)).filter((i) => i !== null);
    const leadAt = (b) => sounds.filter((n) => n.t > b * L - 1e-6 && n.t < (b + 1) * L - 1e-6 && n.midi >= 60).length;
    assert.ok(leadAt(0) >= first.length);
    assert.equal(heardIn(sounds, 16 * L, L, step), heardIn(sounds, 0, L, step), `${id}: round again after 16 bars`);
  }
});
