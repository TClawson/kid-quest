// "Teach me your piano", the game's rules: which keys the robot asks for and in what order,
// what it makes of each thing it hears (pianoteach.js keyEar), and what a taught piano kept on
// the tablet looks like. Pure rules, no screen and no sound.
//
// A taught piano is { v: 1, df, gamma, keys: { [midi]: { pic (Float32Array), cents, B, n } } }
// (pianoteach.js). The robot is taught group by group: a group is a run of keys next to each
// other, played one at a time from the lowest up.

/** The keys the game asks for: A2 to C8. Under A2 the tablet hears too little of a string to know it again (listener.js taughtFrom). */
export const TEACH_LOW = 45;
export const TEACH_HIGH = 108;

const run = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The groups, in the order they are offered: from the middle of the piano outward. */
export const TEACH_GROUPS = [
  { id: 'middle', name: 'The middle', keys: run(60, 71), start: 'Start on middle C.' },
  { id: 'low', name: 'Low keys', keys: run(48, 59), start: 'Start on the C below middle C.' },
  { id: 'high', name: 'High keys', keys: run(72, 83), start: 'Start on the C above middle C.' },
  { id: 'deep', name: 'Three deep keys', keys: run(TEACH_LOW, 47), start: 'Start on the A two keys under the low C.' },
  { id: 'higher', name: 'Higher keys', keys: run(84, 95), start: 'Start two Cs above middle C.' },
  { id: 'top', name: 'The very top', keys: run(96, TEACH_HIGH), start: 'Start three Cs above middle C and go to the last key.' },
];

export const TEACH_KEYS = TEACH_GROUPS.reduce((n, g) => n + g.keys.length, 0);

/** An answer that comes this soon after a key was taken is that key's own noise (it being let go), not a new try. */
export const ECHO = 0.8;
/** A sample this loud has hit the top of what the microphone can take. */
export const TOO_LOUD = 0.999;

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** A key's name for a kid ("F♯"). */
export const keyName = (midi) => NAMES[((midi % 12) + 12) % 12];
/** Whether a key is a black one. */
export const isBlack = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

export const groupById = (id) => TEACH_GROUPS.find((g) => g.id === id) || null;

/** How many of a group's keys a piano knows. */
export function knownIn(piano, group) {
  return group.keys.filter((m) => piano?.keys?.[m]).length;
}

/** How many of the game's keys a piano knows. */
export function knownKeys(piano) {
  return TEACH_GROUPS.reduce((n, g) => n + knownIn(piano, g), 0);
}

/**
 * The ears use a taught piano once it knows this many of the game's keys. With only a group
 * or two taught, taught and guessed fingerprints sit side by side and the ears do a little
 * worse than with none (measured on a real piano); a few keys left out do no harm.
 */
export const TEACH_READY = 56;

/** A taught piano when the ears can use it, or null. */
export const usablePiano = (piano) => (piano && knownKeys(piano) >= TEACH_READY ? piano : null);

/** The group to teach next: the first one with a key still unknown, or null when the robot knows them all. */
export function nextGroup(piano) {
  return TEACH_GROUPS.find((g) => knownIn(piano, g) < g.keys.length) || null;
}

/**
 * A taught piano as kept, checked: anything that is not a sound picture is left out. null
 * when nothing usable is left.
 */
export function cleanPiano(raw) {
  if (!raw || typeof raw !== 'object' || !(Number(raw.df) > 0) || !raw.keys || typeof raw.keys !== 'object') return null;
  const keys = {};
  let size = 0;
  for (const [m, k] of Object.entries(raw.keys)) {
    const midi = Number(m);
    if (!Number.isInteger(midi) || midi < 21 || midi > 108 || !k || typeof k !== 'object') continue;
    const len = k.pic?.length;
    if (!Number.isInteger(len) || len < 64 || len > 4096 || (size && len !== size)) continue;
    const pic = Float32Array.from(k.pic);
    let sum = 0; let ok = true;
    for (let b = 0; b < len; b += 1) { if (!(pic[b] >= 0) || !Number.isFinite(pic[b])) { ok = false; break; } sum += pic[b]; }
    if (!ok || !(sum > 0)) continue;
    const cents = Number(k.cents); const B = Number(k.B);
    size = len;
    keys[midi] = { pic, cents: Number.isFinite(cents) ? Math.max(-100, Math.min(100, cents)) : 0, B: B > 0 && Number.isFinite(B) ? B : 0, n: Number.isInteger(k.n) && k.n > 0 ? k.n : 1 };
  }
  if (!Object.keys(keys).length) return null;
  return { v: 1, df: Number(raw.df), gamma: Number(raw.gamma) > 0 ? Number(raw.gamma) : 0.7, keys };
}

/**
 * A round of the game: one group, from its lowest key up. { group, keys, at (which key is
 * waited for), got ({ [midi]: what it taught }), last (the key taken last: { midi, at }),
 * skipped ([midi]), done }.
 */
export function newRound(groupId) {
  const g = groupById(groupId);
  if (!g) return null;
  return { group: g.id, keys: g.keys.slice(), at: 0, got: {}, last: null, skipped: [], done: false };
}

/** The key a round waits for (null when it is done). */
export const wanted = (round) => (round && !round.done ? round.keys[round.at] : null);

/**
 * What a round makes of something the ears heard (a keyEar answer). The round moves on when
 * it was the key waited for. Returns { what, ... }:
 *   'strike'   a key was just struck (it is ringing; nothing is known yet)
 *   'key'      it was the right key: { midi, loud (true: it hit the top of the microphone) }
 *   'done'     ... and it was the last one of the round
 *   'other'    another key: { midi, off (keys from the wanted one: under 0 is too low) }
 *   'again'    the key taken last was played once more
 *   'unclear'  no string could be made out
 *   'fast'     the next key came before this one had rung
 *   'echo'     nothing to say (a key's own noise right after it was taken, or the round is over)
 */
export function roundStep(round, ev) {
  if (!round || round.done || !ev) return { what: 'echo' };
  if (ev.type === 'strike') return { what: 'strike' };
  const want = round.keys[round.at];
  if (ev.type === 'key' && ev.midi === want && ev.learned) {
    round.got[want] = ev.learned;
    round.last = { midi: want, at: ev.at };
    round.at += 1;
    round.done = round.at >= round.keys.length;
    return { what: round.done ? 'done' : 'key', midi: want, loud: ev.peak >= TOO_LOUD };
  }
  if (round.last && ev.at - round.last.at < ECHO) return { what: 'echo' };
  if (ev.type === 'other' && Number.isInteger(ev.midi)) {
    if (round.last && ev.midi === round.last.midi) return { what: 'again', midi: ev.midi };
    return { what: 'other', midi: ev.midi, off: ev.midi - want };
  }
  if (ev.type === 'fast') return { what: 'fast' };
  return { what: 'unclear' };
}

/** Leave out the key a round waits for (a key that is broken, or that the robot can't make out). */
export function skipKey(round) {
  if (!round || round.done) return round;
  round.skipped.push(round.keys[round.at]);
  round.at += 1;
  round.last = null;
  round.done = round.at >= round.keys.length;
  return round;
}

/** How far off a key was, in words for a kid ("2 keys too low", "one octave too high"). */
export function offWords(off) {
  const n = Math.abs(off);
  const way = off < 0 ? 'too low' : 'too high';
  if (n === 12) return `one octave ${way}`;
  if (n === 24) return `two octaves ${way}`;
  return `${n} ${n === 1 ? 'key' : 'keys'} ${way}`;
}
