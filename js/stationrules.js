// The buddy station's rules (js/station.js draws the screen): which printed chore token belongs to
// which kid's chore, and what one reading of a token means. Pure functions only: no screen, no
// saving, no clock (the time is always passed in), so every rule has a unit test
// (test/stationrules.test.js).
//
// A token is an NFC sticker inside a printed token. Its serial number links it to one kid's chore:
// kid.tokens[serial] = { task, song }, task the chore's id and song the work song's length in
// seconds. It is a map so that linking one token saves one field of the kid and never their
// chore list.
//
// Two taps of the same token: the first starts the chore and its work song and saves startedAt on
// that one chore's record for the day (no status, so every screen still shows it as not done).
// The second, at least MIN_MS later, checks it off as the kid's own "I did it" would, with
// by: 'token': waiting for a parent when the chore is one a parent checks, else done.

/** A reading is a new tap only when that tag hasn't been read for this long (a token resting on the phone never counts). */
export const REPEAT_MS = 5000;
/** The second tap counts only this long after the first. */
export const MIN_MS = 20000;
/** Song lengths a parent can pick, in minutes. */
export const SONG_MINUTES = [1, 2, 3, 4, 5];

/** The starting song length for a chore, in seconds: 1 minute for the bed, 2 for teeth and anything else. */
export function defaultSong(task) {
  return /\bbed\b/i.test(task?.name || '') ? 60 : 120;
}

/** Chores a token can stand for: not timer chores (the piano timer is their own clock). */
export function linkable(task) {
  return Boolean(task) && !(task.minutes > 0);
}

/** Which kid and chore a token is linked to: { kid, link } or null. */
export function findToken(kids, serial) {
  for (const kid of kids || []) {
    const link = kid.tokens?.[serial];
    if (link?.task) return { kid, link };
  }
  return null;
}

/** The tokens linked to one kid's chore (usually one), as serial numbers. */
export function tokensFor(kid, taskId) {
  return Object.entries(kid?.tokens || {}).filter(([, l]) => l?.task === taskId).map(([s]) => s);
}

/**
 * Link a token to a kid's chore, moving it from wherever it was (another chore or another kid).
 * The song length stays when the token keeps its chore. Changes the kids in place; returns the
 * kids it changed.
 */
export function linkToken(kids, kidId, serial, taskId, song) {
  const changed = [];
  let keep = null;
  for (const kid of kids) {
    const old = kid.tokens?.[serial];
    if (!old) continue;
    if (kid.id === kidId && old.task === taskId) keep = old.song;
    delete kid.tokens[serial];
    changed.push(kid);
  }
  const kid = kids.find((k) => k.id === kidId);
  if (!kid) return changed;
  kid.tokens ||= {};
  kid.tokens[serial] = { task: taskId, song: song || keep || 120 };
  if (!changed.includes(kid)) changed.push(kid);
  return changed;
}

/** Forget a token. Returns the kid it was linked on, or null. */
export function unlinkToken(kids, serial) {
  const found = findToken(kids, serial);
  if (!found) return null;
  delete found.kid.tokens[serial];
  return found.kid;
}

/** Set the song length of every token on a kid's chore. Returns whether anything changed. */
export function setSong(kid, taskId, seconds) {
  let changed = false;
  for (const serial of tokensFor(kid, taskId)) {
    if (kid.tokens[serial].song !== seconds) { kid.tokens[serial].song = seconds; changed = true; }
  }
  return changed;
}

/**
 * The five-second rule. lastReads: Map of serial -> time of that tag's last reading (any reading,
 * counted or not). Returns whether this reading is a new tap, and remembers it.
 */
export function freshTap(lastReads, serial, now) {
  const last = lastReads.get(serial);
  lastReads.set(serial, now);
  return last == null || now - last >= REPEAT_MS;
}

/**
 * Chores already in play, rebuilt from today's records when the station opens: a linked chore on
 * today's list with startedAt and no status. One per kid (the latest start).
 * kids: the kids; records(kid) -> today's tasks map; todays(kid) -> today's chore ids.
 * Returns a Map of kidId -> { serial, task, startedAt, song }.
 */
export function inPlayFrom(kids, records, todays) {
  const out = new Map();
  for (const kid of kids || []) {
    const recs = records(kid) || {};
    const ids = new Set(todays(kid));
    for (const [serial, link] of Object.entries(kid.tokens || {})) {
      const r = recs[link?.task];
      if (!ids.has(link?.task) || !r?.startedAt || r.status) continue;
      const was = out.get(kid.id);
      if (!was || r.startedAt > was.startedAt) out.set(kid.id, { serial, task: link.task, startedAt: r.startedAt, song: link.song || 120 });
    }
  }
  return out;
}

/**
 * What one reading of a token means. Everything it needs is passed in:
 * - fresh: whether it is a new tap (freshTap)
 * - found: findToken's answer for the serial (null when nobody linked it)
 * - onToday: whether the chore is on the kid's list today
 * - record: the chore's record for today, or null
 * - playing: the kid's chore in play ({ serial, task, startedAt, song }), or null
 * - task: the chore ({ verify })
 * - now: the time
 * Returns { kind, ... }:
 * - 'ignore': a repeat reading of a token still on the phone. Nothing happens.
 * - 'unlinked': nobody linked this token. A puzzled look.
 * - 'wave', reason 'not-today' | 'done' | 'soon' | 'busy': a small wave, nothing saved.
 *   busy carries the chore in play (playing), to show which token it is.
 * - 'start': the first tap. Save `save` on the chore's record (startedAt), start the song.
 * - 'finish': the second tap. Save `save` on the chore's record (status, at, by: 'token').
 *   took: ms since the first tap.
 */
export function decideTap({ fresh, found, onToday, record, playing, task, now }) {
  if (!fresh) return { kind: 'ignore' };
  if (!found) return { kind: 'unlinked' };
  const taskId = found.link.task;
  if (!onToday) return { kind: 'wave', reason: 'not-today' };
  const st = record?.status;
  if (st === 'done' || st === 'pending') return { kind: 'wave', reason: 'done' };
  if (playing && playing.task !== taskId) return { kind: 'wave', reason: 'busy', playing };
  if (playing) {
    if (now - playing.startedAt < MIN_MS) return { kind: 'wave', reason: 'soon' };
    return { kind: 'finish', took: now - playing.startedAt, save: finishRecord(task, now, playing.startedAt) };
  }
  return { kind: 'start', save: { startedAt: now } };
}

/**
 * The check-off a second tap saves: the same as the kid's own "I did it", by a token. took (ms
 * from the first tap) is kept on its own, so it outlasts a parent's approval (which sets at and by).
 */
export function finishRecord(task, now, startedAt) {
  const out = { status: task?.verify === 'parent' ? 'pending' : 'done', at: now, by: 'token' };
  if (startedAt && now >= startedAt) out.took = now - startedAt;
  return out;
}

/** How far through its song a chore in play is: { left (seconds, 0 at the end), part (0 to 1), ending (in the last part) }. */
export function songProgress(playing, now) {
  const len = Math.max(1, playing.song || 120);
  const gone = Math.max(0, (now - playing.startedAt) / 1000);
  const left = Math.max(0, len - gone);
  return { left, part: Math.min(1, gone / len), ending: left > 0 && left <= endPart(len) };
}

/** The last part of a song, which sounds different so the end can be heard coming: a quarter, 10 to 20 seconds. */
export function endPart(len) {
  return Math.max(10, Math.min(20, len / 4));
}

/** Which kid's song plays: the chore started first whose song hasn't ended. Returns the kidId or null. */
export function songLead(playing, now) {
  let lead = null;
  for (const [kidId, p] of playing) {
    if (songProgress(p, now).left <= 0) continue;
    if (!lead || p.startedAt < lead.startedAt) lead = { kidId, startedAt: p.startedAt };
  }
  return lead?.kidId ?? null;
}

/** "3 min", "45 s", "1 h 5 min": how long a chore took. */
export function tookText(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** What the parents' Today view says about a chore's token run, from its record, or ''. */
export function tokenNote(record) {
  if (!record || (record.status !== 'done' && record.status !== 'pending')) return '';
  const viaToken = record.by === 'token' || record.took != null;
  if (!viaToken) return '';
  const took = record.took != null ? ` · took ${tookText(record.took)}` : '';
  return `Done with a token${took}${record.by === 'parent' ? ' · approved' : ''}`;
}
