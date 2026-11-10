// Sheet music for the game's songs (the music house's sheet music stand, songbook.js): each
// song's lead written out for piano, as ABC notation for abcjs to engrave. The right hand
// plays the melody (moved down an octave or two when it sits high above the staff), the
// chord names go above it, and an easy left hand (root notes or chords) goes on a bass
// staff below. Also the songbook itself: which pieces there are, how hard each is, and
// which unlock with each piano (the first piano opens every map song, the upright piano the
// secret shows' tunes, and a finished treasure map opens its show's tune early), and buying an
// open piece with coins (SONG_PRICE). Pure logic, no DOM.

import { SONGS, SHOW_SONGS, barChords } from './songs.js';

const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const ALTER = { '#': 1, b: -1, '': 0 };
const SIGN = { 1: '♯', '-1': '♭', 0: '' };

/** 'F#5' → { letter: 3, alter: 1, octave: 5, midi: 78 }. */
export function parseNote(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const letter = LETTERS.indexOf(m[1]);
  const alter = ALTER[m[2]];
  const octave = Number(m[3]);
  return { letter, alter, octave, midi: (octave + 1) * 12 + NATURAL[letter] + alter };
}

// ---------- keys ----------

// sharps and flats in key signatures, in the order they are added
const SHARPS = 'FCGDAEB';
const FLATS = 'BEADGCF';
// a mode's key signature is the major key this many letters and semitones below its tonic
const MODES = { '': ['major', 0, 0], m: ['minor', 5, 9], dor: ['dorian', 1, 2], lyd: ['lydian', 3, 5], mix: ['mixolydian', 4, 7] };
// sharps (+) or flats (-) of the major keys on the white keys; a sharp or flat tonic adds or takes 7
const WHITE_SIG = [0, 2, 4, -1, 1, 3, 5];
const pcOf = (name) => (NATURAL[LETTERS.indexOf(name[0])] + (ALTER[name.slice(1)] || 0) + 12) % 12;

/** 'Dm' → { tonic: 'D', mode: 'minor', sig: -1 }: the key's tonic, mode and sharps (+) or flats (-). */
export function keyInfo(key) {
  const m = /^([A-G][#b]?)(m|dor|lyd|mix)?$/.exec(key);
  if (!m) throw new Error(`bad key ${key}`);
  const [mode, letters, semis] = MODES[m[2] || ''];
  // the major key with the same signature, spelled by letter (A minor → C, A# minor → C#)
  const letter = (LETTERS.indexOf(m[1][0]) - letters + 7) % 7;
  let alter = (pcOf(m[1]) - semis - NATURAL[letter] + 24) % 12;
  if (alter > 6) alter -= 12;
  const sig = WHITE_SIG[letter] + 7 * alter;
  if (Math.abs(sig) > 7) throw new Error(`no key signature for ${key}`);
  return { tonic: m[1], mode, sig };
}

/** How a key is shown to kids: 'C major', 'D minor', 'B♭ major', 'D dorian'. */
export function keyLabel(key) {
  const { tonic, mode } = keyInfo(key);
  return `${tonic[0]}${SIGN[ALTER[tonic.slice(1)]] || ''} ${mode}`;
}

/** The key signature as an alteration per letter (0 C ... 6 B). */
export function signature(key) {
  const { sig } = keyInfo(key);
  const alter = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.abs(sig); i += 1) alter[LETTERS.indexOf((sig > 0 ? SHARPS : FLATS)[i])] = Math.sign(sig);
  return alter;
}

// ---------- chords ----------

/** 'Bbm' → [root, third, fifth] as notes { letter, alter } (spelled from the root up). */
export function chordNotes(name) {
  const m = /^([A-G])([#b]?)(m|dim)?$/.exec(name);
  if (!m) throw new Error(`bad chord ${name}`);
  const letter = LETTERS.indexOf(m[1]);
  const rootPc = NATURAL[letter] + ALTER[m[2]];
  const steps = [[0, 0], [2, m[3] ? 3 : 4], [4, m[3] === 'dim' ? 6 : 7]];
  return steps.map(([up, semis]) => {
    const l = (letter + up) % 7;
    let alter = ((rootPc + semis - NATURAL[l]) % 12 + 12) % 12;
    if (alter > 6) alter -= 12;
    return { letter: l, alter };
  });
}

/** A chord name as shown above the staff: 'Bb' → 'B♭', 'C#m' → 'C♯m'. */
export const chordLabel = (name) => name.replace(/^([A-G])#/, '$1♯').replace(/^([A-G])b/, '$1♭');

// ---------- rhythm ----------

/** A song's time: steps (eighth notes) a bar, the ABC meter, and where the beats fall. */
export function meterOf(song) {
  const steps = song.beat || 8;
  if (steps === 6) return { steps, meter: '3/4', middle: null }; // the waltz: three quarter notes
  return { steps, meter: '4/4', middle: 4 };
}

const WHOLE = [8, 6, 4, 3, 2, 1]; // note lengths in eighths that are a single note (dotted or not)

/**
 * Split a note (or a rest) of length len starting at step pos into ones that can be written,
 * tied together: a note that starts off the beat breaks at the middle of a 4/4 bar, and a
 * length that isn't one note (5, 7) breaks into the biggest that fits and the rest. Rests
 * show the beats more plainly: one that starts off the beat goes only to the next beat, a
 * waltz rest after the first beat goes beat by beat, and in 4/4 a rest always breaks at the
 * middle (unless it fills the bar) and is never a dotted half.
 */
export function splitLength(pos, len, meter, rest = false) {
  const parts = [];
  let p = pos;
  let left = len;
  while (left > 0) {
    let room = left;
    const crosses = meter.middle && p < meter.middle && p + left > meter.middle;
    const wholeBar = p === 0 && left === meter.steps;
    if (crosses && (p % 2 === 1 || (rest && !wholeBar))) room = meter.middle - p;
    if (rest && (p % 2 === 1 || (!meter.middle && p > 0))) room = Math.min(room, 2 - (p % 2));
    const d = WHOLE.find((w) => w <= room && !(rest && meter.middle && w === 6));
    parts.push(d);
    p += d;
    left -= d;
  }
  return parts;
}

/** A bar's tokens to [{ pos, len, note|null }]: notes with their holds, and rests. */
export function barEvents(bar) {
  const t = bar.trim().split(/\s+/);
  const out = [];
  for (let i = 0; i < t.length;) {
    let j = i + 1;
    while (j < t.length && t[j] === '-') j += 1;
    if (t[i] === '.') {
      // rests: a run of them (and any holds after them) is one rest
      while (j < t.length && (t[j] === '.' || t[j] === '-')) j += 1;
      out.push({ pos: i, len: j - i, note: null });
    } else {
      out.push({ pos: i, len: j - i, note: t[i] === '-' ? null : t[i] });
    }
    i = j;
  }
  return out;
}

// ---------- the songbook ----------

const onPaper = new Map();
/**
 * A piece's song data as its sheet music has it: 'bg-meadow' is a map song, 'show:bg-meadow' a
 * secret show's tune. A song with a closing bar (songs.js: ending) has it here as its last
 * bar; the game's loop never plays it.
 */
export function songById(id) {
  const song = id.startsWith('show:') ? SHOW_SONGS[id.slice(5)] : SONGS[id];
  if (!song?.ending) return song;
  if (!onPaper.has(id)) onPaper.set(id, { ...song, lead: [...song.lead, song.ending.lead], chords: [...song.chords, song.ending.chord] });
  return onPaper.get(id);
}

const BLACK = new Set([1, 3, 6, 8, 10]); // the black keys, as notes in the octave from C
// the home map's song: every kid has heard it the most, which makes it easier to learn
const FAMILIAR = { 'bg-meadow': 15 };

/**
 * How hard a piece is to play from the page, roughly: more notes a bar, quick notes, tricky
 * rhythms (held from off the beat, tied, dotted), sharps and flats written in the music (the
 * key signature's black keys less so), notes on ledger lines, a wide reach, jumps that move
 * the hand and length all add to it. Tempo doesn't: kids play at their own speed.
 */
export function difficulty(song) {
  const meter = meterOf(song);
  const sig = signature(song.key);
  const shift = melodyShift(song);
  const notes = [];
  let rhythm = 0;
  for (const bar of song.lead) {
    for (const e of barEvents(bar)) {
      if (!e.note) continue;
      const n = parseNote(e.note);
      notes.push({ ...n, len: e.len, written: n.midi + 12 * shift });
      const parts = splitLength(e.pos, e.len, meter);
      if ((e.pos % 2 === 1 && e.len > 1) || parts.length > 1 || parts.includes(3)) rhythm += 1;
    }
  }
  const n = Math.max(1, notes.length);
  const share = (test) => notes.filter(test).length / n;
  const midis = notes.map((x) => x.midi);
  const reach = Math.max(...midis) - Math.min(...midis);
  // jumps past a fifth: the hand has to move (broken chords stay in one place)
  const leaps = notes.slice(1).filter((x, i) => Math.abs(x.midi - notes[i].midi) > 7).length / n;
  return Math.round(
    (notes.length / song.lead.length) * 4
    + share((x) => x.len === 1) * 15
    + (rhythm / n) * 30
    + share((x) => x.alter !== sig[x.letter]) * 40
    + share((x) => x.alter === sig[x.letter] && BLACK.has(x.midi % 12)) * 15
    + share((x) => x.written < 60 || x.written > 80) * 15
    + reach * 0.4
    + leaps * 15
    + song.lead.length * 0.3,
  );
}

/**
 * Every piece in the songbook: { id, name, key, bars, kind ('map' or 'show'), map (the map's
 * background id), level (difficulty), tier (the piano that opens it) }. The map songs come
 * first, easiest first, all opened by the first piano (tier 1). Then the secret shows' tunes,
 * easiest first, opened by the upright piano (tier 2). The rock star piano opens nothing new yet.
 */
export const SONGBOOK = (() => {
  const all = [
    ...Object.entries(SONGS).map(([map, s]) => ({ id: map, map, kind: 'map', song: s })),
    ...Object.entries(SHOW_SONGS).map(([map, s]) => ({ id: `show:${map}`, map, kind: 'show', song: s })),
  ].map((p) => ({ id: p.id, map: p.map, kind: p.kind, name: p.song.name, key: p.song.key, bars: songById(p.id).lead.length, level: difficulty(p.song) - (FAMILIAR[p.id] || 0) }));
  const easiest = (a, b) => a.level - b.level || a.id.localeCompare(b.id);
  const maps = all.filter((p) => p.kind === 'map').sort(easiest).map((p) => ({ ...p, tier: 1 }));
  const shows = all.filter((p) => p.kind === 'show').sort(easiest).map((p) => ({ ...p, tier: 2 }));
  return [...maps, ...shows];
})();

/**
 * The songbook for a music house look (tier 0-3) and the maps whose treasure the kid has
 * found (a Set of background ids): every piece, with open (its piano is here, or, for a
 * show's tune, its treasure map is finished: the kid may have it, and the studio may use it),
 * secret (a show's tune that isn't open: its name stays hidden) and bought (owned: the kid's
 * shared purchases, kid.owned, hold it; see SONG_PRICE). The songbook shows a piece's music
 * only when it is open and bought.
 */
export function songbookFor(tier, found = new Set(), owned = []) {
  const have = songsBought(owned);
  return SONGBOOK.map((p) => {
    const open = tier >= 1 && (tier >= p.tier || (p.kind === 'show' && found.has(p.map)));
    return { ...p, secret: p.kind === 'show' && !open, open, bought: have.has(p.id) };
  });
}

// ---------- buying songs ----------
// Each piece costs SONG_PRICE coins, once: one purchase opens its easy, medium and hard music
// for every buddy. A bought piece goes in the kid's shared purchases (kid.owned, like the
// places and the furniture) as 'song:<piece id>', and its price is added to kid.spent, the
// same two fields a shop purchase changes (so it saves and syncs the same way). These ids are
// not shop items: itemById doesn't know them, so the wardrobe, gear and furniture skip them.

export const SONG_PRICE = 20;
const SONG_PREFIX = 'song:';
/** The id a bought piece has in kid.owned. */
export const songItemId = (pieceId) => `${SONG_PREFIX}${pieceId}`;
/** Whether an id in kid.owned is a bought piece. */
export const isSongItem = (id) => typeof id === 'string' && id.startsWith(SONG_PREFIX);
/** The piece ids bought, from the kid's shared purchases (kid.owned). */
export const songsBought = (owned = []) => new Set((owned || []).filter(isSongItem).map((id) => id.slice(SONG_PREFIX.length)));

/**
 * Whether a piece (from songbookFor) can be bought with the coins the kid has: 'ok', 'bought'
 * (already theirs), 'locked' (the piano doesn't let them have it yet) or 'short' (not enough coins).
 */
export function songBuyCheck(piece, coins) {
  if (!piece) return 'locked';
  if (piece.bought) return 'bought';
  if (!piece.open) return 'locked';
  return coins >= SONG_PRICE ? 'ok' : 'short';
}

/**
 * Buy a piece for a kid who has coins to spend: kid.spent goes up by the price and the piece
 * goes in kid.owned. Does nothing (returns false) unless songBuyCheck says 'ok', so tapping
 * Buy twice never charges twice.
 */
export function buySong(kid, piece, coins) {
  if (songBuyCheck(piece, coins) !== 'ok' || songsBought(kid.owned).has(piece.id)) return false;
  kid.spent = (kid.spent || 0) + SONG_PRICE;
  kid.owned = [...(kid.owned || []), songItemId(piece.id)];
  return true;
}

/** Stars for a piece's level (1-3), for the songbook list. */
export function stars(level) {
  const levels = SONGBOOK.map((p) => p.level);
  const lo = Math.min(...levels);
  const span = Math.max(...levels) - lo || 1;
  return 1 + Math.min(2, Math.floor(((level - lo) / span) * 3));
}

// ---------- ABC ----------

/** A note in ABC at a given octave shift: 'c'' style, with an accidental if one is needed. */
function abcPitch(letter, octave, accidental) {
  const name = LETTERS[letter];
  let s = octave >= 5 ? name.toLowerCase() : name;
  if (octave >= 6) s += "'".repeat(octave - 5);
  if (octave <= 3) s += ','.repeat(4 - octave);
  return `${accidental}${s}`;
}
const ACC = { 1: '^', '-1': '_', 0: '=' };

/** How far to move the melody (0, -1 or -2 octaves) so it sits on the treble staff. */
export function melodyShift(song) {
  const midis = song.lead.flatMap((b) => barEvents(b)).filter((e) => e.note).map((e) => parseNote(e.note).midi);
  const cost = (k) => midis.reduce((n, m) => n + Math.max(0, m + 12 * k - 81) + Math.max(0, 60 - (m + 12 * k)), 0);
  return [0, -1, -2].reduce((best, k) => (cost(k) < cost(best) ? k : best), 0);
}

const lengthText = (len) => (len === 1 ? '' : String(len));

/**
 * Which bars go on each line: [[from, to), ...], perLine to a line, the last lines shared out
 * evenly. A long piece's one bar left over (a closing bar) joins the line before it.
 */
export function lineRanges(bars, perLine) {
  const out = [];
  if (bars % perLine === 1 && bars >= 3 * perLine) {
    for (let at = 0; at < bars - 1; at += perLine) out.push([at, at + perLine]);
    out[out.length - 1][1] = bars;
    return out;
  }
  const per = Math.ceil(bars / Math.ceil(bars / perLine));
  for (let at = 0; at < bars; at += per) out.push([at, Math.min(bars, at + per)]);
  return out;
}

/** The mark over a closing bar's last notes: hold them. */
const FERMATA = '!fermata!';

/** The header line that writes "Swing" over the first bar of a song the game swings. */
export const SWING_MARK = 'Q:"Swing"';

/**
 * One piece as ABC notation for abcjs. o: {
 *   hands: 'melody' (right hand and chord names), 'roots' (+ the left hand's root notes) or
 *     'chords' (+ the left hand's chords),
 *   names: true to write each note's letter under it,
 *   perLine: bars on a line (the last lines are shared out evenly),
 * }
 */
export function songAbc(id, o = {}) {
  const song = songById(id);
  if (!song) throw new Error(`no song ${id}`);
  const hands = o.hands || 'roots';
  const perLine = Math.max(1, o.perLine || 4);
  const meter = meterOf(song);
  const sig = signature(song.key);
  const shift = melodyShift(song);

  const right = [];
  const words = [];
  const left = [];
  song.lead.forEach((bar, b) => {
    // accidentals hold for the rest of the bar, for the same note on the same line or space
    const held = new Map();
    const tokens = [];
    const names = [];
    const chords = barChords(song.chords[b], meter.steps);
    let group = -1;
    for (const e of barEvents(bar)) {
      // a note held over a chord change is cut there (and tied), so the new chord's name has a note to sit on
      const cuts = [e.pos, ...chords.map((c) => c.pos).filter((at) => at > e.pos && at < e.pos + e.len), e.pos + e.len];
      const parts = cuts.slice(1).flatMap((to, k) => splitLength(cuts[k], to - cuts[k], meter, !e.note));
      let pos = e.pos;
      parts.forEach((len, k) => {
        // beam eighth notes within each half bar (each beat in the waltz)
        const g = meter.middle ? Math.floor(pos / meter.middle) : Math.floor(pos / 2);
        const gap = tokens.length && (g !== group || len > 1 || tokens[tokens.length - 1].len > 1) ? ' ' : '';
        group = g;
        let text;
        if (!e.note) {
          text = `z${lengthText(len)}`;
        } else {
          const n = parseNote(e.note);
          const octave = n.octave + shift;
          const spot = `${n.letter}${octave}`;
          const now = held.has(spot) ? held.get(spot) : sig[n.letter];
          const acc = n.alter !== now ? ACC[n.alter] : '';
          held.set(spot, n.alter);
          text = `${abcPitch(n.letter, octave, acc)}${lengthText(len)}${k < parts.length - 1 ? '-' : ''}`;
          names.push(k === 0 ? `${LETTERS[n.letter]}${SIGN[n.alter]}` : '*');
        }
        const chord = chords.find((c) => c.pos === pos);
        if (chord) text = `"${chordLabel(chord.name)}"${text}`;
        // the closing bar's long note is held
        if (song.ending && b === song.lead.length - 1 && e.note && k === 0) text = FERMATA + text;
        tokens.push({ text: gap + text, len });
        pos += len;
      });
    }
    right.push(tokens.map((t) => t.text).join('').trim());
    words.push(names.join(' '));
    if (hands !== 'melody') {
      const low = Math.min(...barEvents(bar).filter((e) => e.note).map((e) => parseNote(e.note).midi + 12 * shift));
      const held = new Map();
      const hand = chords.map((c) => leftHand(c.name, hands, c.len, sig, low, held)).join(' ');
      left.push(song.ending && b === song.lead.length - 1 ? FERMATA + hand : hand);
    }
  });

  const head = [
    'X:1',
    `M:${meter.meter}`,
    'L:1/8',
    song.swing ? SWING_MARK : '',
    `K:${song.key}`,
    hands === 'melody' ? '' : '%%score {(R) | (L)}',
    hands === 'melody' ? '' : 'V:R clef=treble',
    hands === 'melody' ? '' : 'V:L clef=bass',
  ].filter(Boolean);
  const body = [];
  for (const [at, end] of lineRanges(song.lead.length, perLine)) {
    const last = end === song.lead.length;
    const bars = (list) => `${list.slice(at, end).join(' | ')} ${last ? '|]' : '|'}`;
    body.push(hands === 'melody' ? bars(right) : `[V:R] ${bars(right)}`);
    if (o.names) body.push(`w: ${words.slice(at, end).join(' | ')}`);
    if (hands !== 'melody') body.push(`[V:L] ${bars(left)}`);
  }
  return `${head.join('\n')}\n${body.join('\n')}\n`;
}

/**
 * The left hand for one chord of a bar: the chord's root, or the whole chord, held for its
 * steps (all bar, or its share of the bar), on the bass staff and below the bar's lowest
 * melody note (low, as MIDI), so the hands never meet. A chord that would reach the melody
 * turns over (an inversion: the root or the root and third go up an octave, then the whole
 * chord down) before it drops an octave as it is. held: the bar's accidentals so far.
 */
function leftHand(name, hands, steps, sig, low = Infinity, held = new Map()) {
  const tones = chordNotes(name);
  const root = tones[0];
  const midiOf = ({ t, o }) => (o + 1) * 12 + NATURAL[t.letter] + t.alter;
  // the root between G2 and F#3, so it sits on the bass staff
  let octave = 2;
  while (midiOf({ t: root, o: octave }) < 43) octave += 1;
  while (midiOf({ t: root, o: octave }) > 54) octave -= 1;
  // the chord from the root up (the third and fifth up an octave when their letter wraps past B)
  const upright = (hands === 'roots' ? [root] : tones).map((t) => ({ t, o: octave + (t.letter < root.letter ? 1 : 0) }));
  const fits = (v) => Math.max(...v.map(midiOf)) < low;
  let voicing = upright;
  if (!fits(voicing) && hands === 'chords') {
    // turned over: [third, fifth, root + 8va] and [fifth, root + 8va, third + 8va], an octave down
    const turned = [1, 2].map((k) => [...upright.slice(k), ...upright.slice(0, k).map(({ t, o }) => ({ t, o: o + 1 }))].map(({ t, o }) => ({ t, o: o - 1 })));
    // the highest that fits and stays on or just under the bass staff (bottom note E2 or up)
    const best = turned.filter((v) => fits(v) && midiOf(v[0]) >= 40).sort((x, y) => midiOf(y[2]) - midiOf(x[2]))[0];
    if (best) voicing = best;
  }
  while (!fits(voicing) && voicing[0].o > 1) voicing = voicing.map(({ t, o }) => ({ t, o: o - 1 }));
  const notes = voicing.map(({ t, o }) => {
    const spot = `${t.letter}${o}`;
    const now = held.has(spot) ? held.get(spot) : sig[t.letter];
    held.set(spot, t.alter);
    return abcPitch(t.letter, o, t.alter !== now ? ACC[t.alter] : '');
  });
  const len = lengthText(steps);
  return notes.length === 1 ? `${notes[0]}${len}` : `[${notes.join('')}]${len}`;
}
