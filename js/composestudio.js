// A song from the composing desk (composerules.js) as a tune the recording studio can put in a
// mix (tunerules.js shape): the kid's tune on one track and their chords as a band part on
// another, both passes of the loop when they fit in the studio's thirty seconds (the second
// time up an octave when the song asks for it), else one pass. Pure, no screen.

import { METERS, BARS, PASSES, chordDef, voicing, loopSeconds } from './composerules.js';
import { cleanTune } from './tunerules.js';
import { MAX_SECONDS } from './studiorules.js';
import { abcKey } from './composesheet.js';

/** The studio voice each desk sound plays in. */
export const STUDIO_VOICE = { piano: 'steel', chip: 'beep', flute: 'flute' };

/** How the studio counts a timing: beats in a bar and beats a minute (6/8 counts its eighths in threes). */
export function studioCount(meter, bpm) {
  if (meter === '6/8') return { meter: 3, bpm: Math.round(bpm * 1.5) };
  return { meter: meter === '3/4' ? 3 : 4, bpm };
}

/** How many times the eight bars go into the studio: twice when that fits in its loop. */
export const studioPasses = (song) => (loopSeconds(song.meter, song.bpm) <= MAX_SECONDS + 0.01 ? PASSES : 1);

/**
 * A desk song as a studio tune: { v, id, made, reading: 'band', bpm, meter, key, beats,
 * parts: [tune, band], voice, shift, desk (the song's name) } (tidied by cleanTune), or null
 * when it has no notes.
 * Steps are eighth notes in both, so the notes keep their places.
 */
export function songAsTune(song, { id = 'desk-song', made = 0 } = {}) {
  if (!song?.tune?.some(Number.isInteger)) return null;
  const st = METERS[song.meter].steps;
  const len = song.tune.length;
  const passes = studioPasses(song);
  const notes = [];
  const band = [];
  for (let p = 0; p < passes; p += 1) {
    const t0 = p * len;
    const up = p === 1 && song.second === 'high' ? 12 : 0;
    song.tune.forEach((v, i) => {
      if (!Number.isInteger(v)) return;
      let end = i + 1;
      while (end < len && song.tune[end] === null) end += 1;
      notes.push({ at: t0 + i, len: end - i, midi: v + up });
    });
    for (let b = 0; b < BARS; b += 1) {
      const { bass, tones } = voicing(song.key, chordDef(song.key.mode, song.bars[b]));
      for (const midi of [bass, ...tones]) band.push({ at: t0 + b * st, len: st, midi });
    }
  }
  const count = studioCount(song.meter, song.bpm);
  const beats = (passes * len) / 2;
  const out = cleanTune({
    v: 1, id, made, reading: 'band', bpm: count.bpm, meter: count.meter, key: abcKey(song.key),
    parts: [{ role: 'tune', notes, beats }, { role: 'band', notes: band, beats }],
    voice: STUDIO_VOICE[song.voice] || STUDIO_VOICE.piano, shift: 0,
  });
  // its clips in a mix carry the song's name (studiorules.js addTune)
  if (out) out.desk = (song.name || 'My song').slice(0, 40);
  return out;
}
