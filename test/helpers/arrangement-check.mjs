// Checks a medium or hard version of a songbook piece (js/arrangements.js) against the song
// and the rules for its level: whole bars, the melody kept, the left hand on the chords, the
// hands never meeting, stretches a kid's hand can make, and harder than the level below.
// Used by test/arrangements.test.js, and by hand while writing versions.

import { readAbcBar, arrangementNotes } from '../../js/arrange.js';
import { songById, signature, meterOf, barEvents, parseNote, chordNotes, melodyShift } from '../../js/sheetmusic.js';

const NATURAL = [0, 2, 4, 5, 7, 9, 11];

/** What each level allows. */
export const RULES = {
  medium: {
    rhChord: 2, lhChord: 3, // the most notes played together in a hand
    rhSpan: 9, lhSpan: 12, // the widest stretch (semitones) of notes played together
    shortest: 1, // the shortest note (eighths): no sixteenths
    melody: 0.95, // the share of the melody's notes that must be there
    exact: true, // the melody's own rhythm, as the right hand's top note, at one octave all through
  },
  hard: { rhChord: 4, lhChord: 4, rhSpan: 12, lhSpan: 12, shortest: 0.5, melody: 0.8, exact: false },
};
const RANGE = { rh: [53, 96], lh: [33, 64] }; // F3 to C7, A1 to E4
const CHORD_TONES = 0.7; // the share of the left hand (by length) on the bar's chord, over the piece
const CHORD_TONES_BAR = 0.5; // ... and in each bar

const pitchClasses = (name) => new Set(chordNotes(name).map((t) => (NATURAL[t.letter] + t.alter + 12) % 12));

/**
 * Check one version ({ rh: [bar], lh: [bar] }) of piece id at level ('medium' or 'hard').
 * lower: the level below's density (events a bar, both hands) when known. Returns
 * { errors: [text], notes: [text] (worth a look, not wrong), stats }.
 */
export function checkArrangement(id, level, version, lower = null) {
  const song = songById(id);
  const rules = RULES[level];
  const errors = [];
  const notes = [];
  if (!song) return { errors: [`no song ${id}`], notes, stats: {} };
  if (!rules) return { errors: [`no level ${level}`], notes, stats: {} };
  const steps = meterOf(song).steps;
  const sig = signature(song.key);
  const bars = song.lead.length;
  const where = (hand, b) => `${level} ${hand} bar ${b + 1}`;

  // whole bars that can be read
  const read = {};
  for (const hand of ['rh', 'lh']) {
    if (!Array.isArray(version?.[hand]) || version[hand].length !== bars) {
      errors.push(`${level} ${hand}: needs ${bars} bars, has ${version?.[hand]?.length ?? 0}`);
      return { errors, notes, stats: {} };
    }
    read[hand] = version[hand].map((text, b) => {
      const r = readAbcBar(text, sig);
      for (const e of r.errors) errors.push(`${where(hand, b)}: ${e}`);
      if (Math.abs(r.length - steps) > 1e-6) errors.push(`${where(hand, b)}: ${r.length} eighths, needs ${steps} ("${text}")`);
      if (/\|/.test(text)) errors.push(`${where(hand, b)}: no bar lines inside a bar`);
      for (const e of r.events) {
        if (e.len < rules.shortest - 1e-6) errors.push(`${where(hand, b)}: a note shorter than ${rules.shortest === 1 ? 'an eighth' : 'a sixteenth'}`);
        const max = hand === 'rh' ? rules.rhChord : rules.lhChord;
        if (e.notes.length > max) errors.push(`${where(hand, b)}: ${e.notes.length} notes at once (at most ${max})`);
        if (e.notes.length > 1) {
          const midis = e.notes.map((n) => n.midi);
          const span = Math.max(...midis) - Math.min(...midis);
          const most = hand === 'rh' ? rules.rhSpan : rules.lhSpan;
          if (span > most) errors.push(`${where(hand, b)}: a stretch of ${span} semitones (at most ${most})`);
          if (new Set(midis).size < midis.length) errors.push(`${where(hand, b)}: the same note twice in a chord`);
        }
        for (const n of e.notes) {
          const [lo, hi] = RANGE[hand];
          if (n.midi < lo || n.midi > hi) errors.push(`${where(hand, b)}: note ${n.midi} is out of the ${hand === 'rh' ? 'right' : 'left'} hand's range (${lo}-${hi})`);
        }
      }
      return r;
    });
  }
  if (errors.length) return { errors, notes, stats: {} };

  const all = arrangementNotes(id, level, version);
  const rh = all.filter((n) => n.hand === 'rh');
  const lh = all.filter((n) => n.hand === 'lh');

  // the hands never meet: the left hand's top note is always below the right hand's lowest
  const times = [...new Set(all.flatMap((n) => [n.start]))].sort((a, b) => a - b);
  for (const t of times) {
    const sounding = (list) => list.filter((n) => n.start <= t + 1e-6 && t < n.start + n.len - 1e-6).map((n) => n.midi);
    const r = sounding(rh);
    const l = sounding(lh);
    const spot = `${level} bar ${Math.floor(t / steps) + 1}, eighth ${(t % steps) + 1}`;
    if (r.length && l.length && Math.max(...l) >= Math.min(...r)) {
      errors.push(`${spot}: the hands meet (left ${Math.max(...l)} ≥ right ${Math.min(...r)})`);
    } else if (r.length && l.length && Math.min(...r) - Math.max(...l) < 3) {
      notes.push(`${spot}: the thumbs are only ${Math.min(...r) - Math.max(...l)} semitone(s) apart`);
    }
    // a semitone (or a minor 9th) between notes struck or held together rubs
    const both = [...r, ...l].sort((a, b) => a - b);
    for (let i = 0; i < both.length; i += 1) {
      for (let j = i + 1; j < both.length; j += 1) {
        const gap = both[j] - both[i];
        if (gap === 1 || gap === 13) notes.push(`${spot}: notes ${both[i]} and ${both[j]} rub (a ${gap === 1 ? 'semitone' : 'minor 9th'})`);
      }
    }
  }
  // the right hand's harmony notes (under the top note), struck on a beat, belong to the chord
  for (const t of times) {
    if (t % 2 > 1e-6) continue;
    const struck = rh.filter((n) => Math.abs(n.start - t) < 1e-6).map((n) => n.midi).sort((a, b) => a - b);
    const tones = pitchClasses(song.chords[Math.floor(t / steps)]);
    const top = struck[struck.length - 1];
    // (an octave under the top note doubles the melody, so it can pass outside the chord)
    for (const m of struck.slice(0, -1)) if (m % 12 !== top % 12 && !tones.has(m % 12)) notes.push(`${level} bar ${Math.floor(t / steps) + 1}, eighth ${(t % steps) + 1}: right-hand harmony note ${m} isn't in the ${song.chords[Math.floor(t / steps)]} chord`);
  }

  // the melody is there
  const shift = 12 * melodyShift(song);
  const melody = song.lead.flatMap((bar, b) => barEvents(bar).filter((e) => e.note).map((e) => ({ t: b * steps + e.pos, midi: parseNote(e.note).midi, bar: b })));
  let kept = 0;
  const missed = new Set();
  if (rules.exact) {
    // the right hand's top note starts with each melody note, at one octave all through
    const top = (t) => {
      const starting = rh.filter((n) => Math.abs(n.start - t) < 1e-6);
      return starting.length ? Math.max(...starting.map((n) => n.midi)) : null;
    };
    const octaves = new Map();
    for (const m of melody) { const tp = top(m.t); if (tp !== null && (tp - m.midi) % 12 === 0) octaves.set(tp - m.midi, (octaves.get(tp - m.midi) || 0) + 1); }
    const k = [...octaves.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? shift;
    for (const m of melody) { if (top(m.t) === m.midi + k) kept += 1; else missed.add(m.bar + 1); }
    if (k !== shift) notes.push(`the melody is ${(k - shift) / 12 > 0 ? 'up' : 'down'} ${Math.abs(k - shift) / 12} octave(s) from the easy version`);
  } else {
    // the melody's note sounds in the right hand at (or within an eighth of) each melody note
    for (const m of melody) {
      const near = rh.some((n) => (n.midi - m.midi) % 12 === 0 && n.start <= m.t + 1 + 1e-6 && m.t - 1 < n.start + n.len - 1e-6);
      if (near) kept += 1; else missed.add(m.bar + 1);
    }
  }
  const share = kept / Math.max(1, melody.length);
  if (share < rules.melody) errors.push(`${level}: only ${Math.round(share * 100)}% of the melody's notes are there (needs ${rules.melody * 100}%); look at bars ${[...missed].join(', ')}`);
  else if (missed.size) notes.push(`${level}: the melody differs in bars ${[...missed].join(', ')}`);

  // the left hand plays the bar's chord
  let on = 0;
  let total = 0;
  for (let b = 0; b < bars; b += 1) {
    const tones = pitchClasses(song.chords[b]);
    let barOn = 0;
    let barAll = 0;
    for (const n of lh) {
      const from = Math.max(n.start, b * steps);
      const to = Math.min(n.start + n.len, (b + 1) * steps);
      if (to <= from) continue;
      barAll += to - from;
      if (tones.has(n.midi % 12)) barOn += to - from;
    }
    on += barOn;
    total += barAll;
    if (barAll && barOn / barAll < CHORD_TONES_BAR) notes.push(`${level} lh bar ${b + 1}: mostly notes outside the ${song.chords[b]} chord`);
  }
  if (total && on / total < CHORD_TONES) errors.push(`${level}: the left hand is only ${Math.round((on / total) * 100)}% on the chords (needs ${CHORD_TONES * 100}%)`);
  if (!total) errors.push(`${level}: the left hand never plays`);

  // harder than the level below
  const events = (hand) => read[hand].reduce((a, r) => a + r.events.filter((e) => e.notes.length).length, 0) / bars;
  const keys = (hand) => read[hand].reduce((a, r) => a + r.events.reduce((k, e) => k + e.notes.length, 0), 0) / bars;
  const stats = {
    rhPerBar: +events('rh').toFixed(1),
    lhPerBar: +events('lh').toFixed(1),
    density: +(keys('rh') + keys('lh')).toFixed(1), // keys pressed a bar, both hands
    melodyKept: Math.round(share * 100),
    chordTones: total ? Math.round((on / total) * 100) : 0,
    lowest: Math.min(...lh.map((n) => n.midi)),
    highest: Math.max(...rh.map((n) => n.midi)),
  };
  if (lower !== null && stats.density <= lower) errors.push(`${level}: ${stats.density} keys pressed a bar is no busier than the level below (${lower})`);
  return { errors, notes, stats };
}

/** The easy version's density: the melody's notes a bar, plus a left-hand note a bar. */
export function easyDensity(id) {
  const song = songById(id);
  const melody = song.lead.flatMap((bar) => barEvents(bar).filter((e) => e.note)).length;
  return +(melody / song.lead.length + 1).toFixed(1);
}
