// The songbook's concert pieces (js/longpieces.js): long pieces in several parts, each part
// with its own key and speed, written out for both hands at every level (no "which hands"
// choice, unlike a map song's easy level). The upright piano opens them, and each is bought
// like any other piece (SONG_PRICE, sheetmusic.js): once, for every level and every buddy.
// This file lists them, reads their bars (arrange.js readAbcBar, which knows two voices in a
// hand), writes a whole piece as one score for abcjs (each part on a new line, with its name,
// key and speed), and works out when every note and bar sounds (the parts' speeds differ,
// and a held bar lasts longer), for Listen (music.js playTimeline). Pure logic, no DOM.
// The recording studio and the Note-o-Matic don't use these pieces: they read SONGBOOK and
// songbookFor (sheetmusic.js), which hold only the map songs and the show tunes.

import { LONG_PIECES } from './longpieces.js';
import { readAbcBar, LEVELS } from './arrange.js';
import { signature, keyInfo, lineRanges, songsBought } from './sheetmusic.js';

/** The piano that opens the concert pieces: the upright piano (music tier 2). */
export const CONCERT_TIER = 2;
/** Eighths a bar: the concert pieces are in 3/4 all through. */
export const BAR = 6;
/** A bar marked !fermata! lasts this many times as long when it's played. */
export const FERMATA_HOLD = 1.7;
/** How loud each dynamic mark plays, against the usual (mf). */
export const DYNAMICS = { pp: 0.6, p: 0.74, mp: 0.88, mf: 1, f: 1.18, ff: 1.35 };

const LETTERS = 'CDEFGAB';
const SIGN = { 2: '𝄪', 1: '♯', 0: '', '-1': '♭', '-2': '𝄫' };

/** Whether a piece id is a concert piece. */
export const isLongPiece = (id) => typeof id === 'string' && Object.hasOwn(LONG_PIECES, id);

/** The levels a concert piece has so far, easiest first (not every level is written yet). */
export const longLevels = (id) => (isLongPiece(id) ? LEVELS.filter((l) => LONG_PIECES[id].levels?.[l]?.length) : []);

/** A concert piece's sections at a level: [{ name, key, bpm, rh, lh, chords }], or null. */
export const longSections = (id, level) => (longLevels(id).includes(level) ? LONG_PIECES[id].levels[level] : null);

/** The level to show: the one asked for when the piece has it, else its easiest. */
export const longLevel = (id, want) => (longLevels(id).includes(want) ? want : longLevels(id)[0] || null);

/**
 * Every concert piece, for the songbook's third section: { id, map, kind: 'long', name, story,
 * parts (sections), tier (the piano that opens it) }. Pieces with no level written are left out.
 */
export const CONCERT = Object.entries(LONG_PIECES)
  .filter(([id]) => longLevels(id).length)
  .map(([id, p]) => ({ id, map: p.map, kind: 'long', name: p.name, story: p.story, parts: longSections(id, longLevels(id)[0]).length, tier: CONCERT_TIER }));

/**
 * The concert pieces for a music house look (tier 0-3) and the kid's shared purchases
 * (kid.owned), like songbookFor: open (the upright piano or better is here; no treasure map
 * opens them early), secret (never: their names always show) and bought.
 */
export function concertBookFor(tier, owned = []) {
  const have = songsBought(owned);
  return CONCERT.map((p) => ({ ...p, open: tier >= p.tier, secret: false, bought: have.has(p.id) }));
}

/** A chord name as shown above the staff, flats and sharps too: 'Gm/Bb' → 'Gm/B♭', 'D/F#' → 'D/F♯'. */
export const longChordLabel = (name) => String(name).replace(/(^|\/)([A-G])#/g, '$1$2♯').replace(/(^|\/)([A-G])b/g, '$1$2♭');

const DYNAMIC = /!(pp|p|mp|mf|f|ff)!/g;
/** The last dynamic mark in a bar's text ('pp' ... 'ff'), or null. */
function dynamicIn(text) {
  const all = [...String(text).matchAll(DYNAMIC)];
  return all.length ? all[all.length - 1][1] : null;
}

/**
 * Every bar of a concert piece at a level, in order: [{ section (its index), bar (in the
 * section), key, bpm, rh, lh (readAbcBar of each hand), chord, fermata (held), dynamic (the
 * mark playing in this bar: one written here, else the last one before, across sections) }].
 * sections: the level's sections (by default the ones in longpieces.js).
 */
export function longBars(id, level, sections = longSections(id, level)) {
  if (!sections) return [];
  const out = [];
  let dynamic = 'mf';
  sections.forEach((s, k) => {
    const sig = signature(s.key);
    s.rh.forEach((rh, b) => {
      const lh = s.lh[b];
      dynamic = dynamicIn(rh) || dynamicIn(lh) || dynamic;
      out.push({
        section: k, bar: b, key: s.key, bpm: s.bpm, chord: s.chords[b],
        rh: readAbcBar(rh, sig), lh: readAbcBar(lh, sig),
        fermata: /!fermata!/.test(rh) || /!fermata!/.test(lh),
        dynamic,
      });
    });
  });
  return out;
}

/**
 * Every note of a concert piece to play: [{ midi, start, len (eighths from the start of the
 * piece, six a bar), hand, gain (its dynamic's loudness) }]. Tied notes are joined into one:
 * a tie is taken up by the next note of the same pitch that starts just where the tied note
 * ends, in either voice of the hand, across bar lines too. sections: as in longBars.
 */
export function longNotes(id, level, sections = longSections(id, level)) {
  const bars = longBars(id, level, sections);
  const out = [];
  for (const hand of ['rh', 'lh']) {
    let open = []; // the notes a tie carries on: { note, end }
    bars.forEach((bar, b) => {
      const events = [...bar[hand].events].sort((x, y) => x.start - y.start || x.voice - y.voice);
      for (const e of events) {
        const start = b * BAR + e.start;
        open = open.filter((t) => t.end >= start - 1e-6); // a tie nothing took up ends
        for (const n of e.notes) {
          const k = open.findIndex((t) => t.note.midi === n.midi && Math.abs(t.end - start) < 1e-6);
          let note;
          if (k >= 0) {
            note = open[k].note;
            note.len += e.len;
            open.splice(k, 1);
          } else {
            note = { midi: n.midi, start, len: e.len, hand, gain: DYNAMICS[bar.dynamic] };
            out.push(note);
          }
          if (e.tie) open.push({ note, end: start + e.len });
        }
      }
    });
  }
  return out.sort((a, b) => a.start - b.start || a.midi - b.midi);
}

/**
 * When a concert piece sounds, at its own speed: { bars (the second each bar starts, and then
 * the end), notes: [{ midi, t, dur (seconds), hand, gain }], seconds (how long it lasts) }.
 * Each bar goes at its section's speed (bpm quarter notes a minute), and a bar with a fermata
 * lasts FERMATA_HOLD times as long, its notes stretched with it. sections: as in longBars.
 */
export function longTimeline(id, level, sections = longSections(id, level)) {
  const bars = longBars(id, level, sections);
  const starts = [0];
  for (const bar of bars) starts.push(starts[starts.length - 1] + (BAR * 30 / bar.bpm) * (bar.fermata ? FERMATA_HOLD : 1));
  // a spot in the piece, in eighths, to seconds
  const time = (x) => {
    const b = Math.max(0, Math.min(bars.length - 1, Math.floor(x / BAR + 1e-9)));
    return starts[b] + ((x - b * BAR) / BAR) * (starts[b + 1] - starts[b]);
  };
  const notes = longNotes(id, level, sections).map((n) => ({ midi: n.midi, t: time(n.start), dur: time(n.start + n.len) - time(n.start), hand: n.hand, gain: n.gain }));
  return { bars: starts, notes, seconds: starts[starts.length - 1] };
}

/** How long a concert piece lasts at a level, in seconds (at its own speed). */
export const longSeconds = (id, level) => longTimeline(id, level).seconds;

/** What the songbook says about a concert piece at a level: '8 parts · about 3 min'. */
export function longFacts(id, level) {
  const parts = longSections(id, level)?.length || 0;
  const min = Math.max(1, Math.round(longSeconds(id, level) / 60));
  return `${parts} parts · about ${min} min`;
}

/**
 * The naturals a key change shows (the old key's sharps or flats that the new key drops), as
 * explicit accidentals for a K: field: ['=a', '=d']. abcjs draws them by itself on the treble
 * staff, but not on a staff whose key change also names its clef, so the left hand gets them
 * written out (they change no note: those letters are natural in the new key anyway).
 */
export function cancels(from, to) {
  const was = signature(from);
  const now = signature(to);
  const order = keyInfo(from).sig > 0 ? 'FCGDAEB' : 'BEADGCF';
  return [...order].filter((l) => was[LETTERS.indexOf(l)] !== 0 && now[LETTERS.indexOf(l)] === 0).map((l) => `=${l.toLowerCase()}`);
}

/** A note's name for the note names under the music: 'F♯'. */
const noteName = (n) => `${LETTERS[n.letter]}${SIGN[n.alter]}`;

/**
 * A concert piece at a level as ABC for abcjs: one score on a grand staff, every section
 * starting on a new line with its name and speed over its first bar ([Q:"name" 1/4=bpm]) and
 * its key signature ([K:...], the left hand keeping its bass clef and showing the naturals of
 * the key it leaves, see cancels), a double bar line where a
 * section ends and the final one at the very end; each bar's chord name above it, and
 * (o.names) the name of the right hand's top note (of its first voice) under each note.
 * o.perLine: bars on a line (each section's last lines shared out evenly, as lineRanges does).
 * sections: as in longBars.
 */
export function longAbc(id, level, o = {}, sections = longSections(id, level)) {
  if (!sections) throw new Error(`no ${level} version of ${id}`);
  const perLine = Math.max(1, o.perLine || 4);
  const head = ['X:1', 'M:3/4', 'L:1/8', `K:${sections[0].key}`, '%%score {(R) | (L)}', 'V:R clef=treble', 'V:L clef=bass'];
  const body = [];
  let carried = null; // the top note a tie from the bar before carries on
  sections.forEach((s, k) => {
    const sig = signature(s.key);
    const right = s.rh.map((text, b) => {
      const { events } = readAbcBar(text, sig);
      // the chord's name goes on the bar's first note (or rest) of the first voice
      const e = events.find((x) => x.voice === 0);
      return (e ? `${text.slice(0, e.col)}"${longChordLabel(s.chords[b])}"${text.slice(e.col)}` : text).trim();
    });
    const words = s.rh.map((text) => {
      const names = [];
      const { events } = readAbcBar(text, sig);
      for (const e of events.filter((x) => x.voice === 0)) {
        if (!e.notes.length) { carried = null; continue; }
        const top = e.notes.reduce((a, n) => (n.midi > a.midi ? n : a));
        names.push(carried === top.midi ? '*' : noteName(top));
        carried = e.tie ? top.midi : null;
      }
      // the other voice's notes take their turn for a name too (abcjs hands them out in
      // order): skip them
      for (const e of events) if (e.voice > 0 && e.notes.length) names.push('*');
      return names.join(' ');
    });
    const name = String(s.name).replace(/"/g, "'");
    const lastSection = k === sections.length - 1;
    for (const [at, end] of lineRanges(s.rh.length, perLine)) {
      const close = end < s.rh.length ? '|' : lastSection ? '|]' : '||';
      const top = at === 0 ? `${k ? `[K:${s.key}] ` : ''}[Q:"${name}" 1/4=${s.bpm}] ` : '';
      const low = at === 0 && k ? `[K:${[s.key, ...cancels(sections[k - 1].key, s.key)].join(' ')} clef=bass] ` : '';
      body.push(`[V:R] ${top}${right.slice(at, end).join(' | ')} ${close}`);
      if (o.names) body.push(`w: ${words.slice(at, end).join(' | ')}`);
      body.push(`[V:L] ${low}${s.lh.slice(at, end).join(' | ')} ${close}`);
    }
  });
  return `${head.join('\n')}\n${body.join('\n')}\n`;
}

/**
 * The plain lead sheet of a concert piece (when abcjs can't load): each section's name, then
 * its bars, each with its chord name and the right hand's top notes (first voice).
 * [{ name, bars: [{ n (bar in the piece), chord, notes: ['D', 'E♭', ...] }] }].
 */
export function longLeadSheet(id, level) {
  const sections = longSections(id, level) || [];
  let n = 0;
  return sections.map((s) => {
    const sig = signature(s.key);
    return {
      name: s.name,
      bars: s.rh.map((text, b) => {
        const notes = readAbcBar(text, sig).events.filter((e) => e.voice === 0).map((e) => (e.notes.length ? noteName(e.notes.reduce((a, x) => (x.midi > a.midi ? x : a))) : '·'));
        return { n: n++, chord: longChordLabel(s.chords[b]), notes };
      }),
    };
  });
}
