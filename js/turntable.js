// The turntable in the buddy's house (a 300-coin piece of furniture, sold once the music house
// is open): it plays the kid's own music, the mixes kept in the recording studio and the tunes
// kept from the Note-o-Matic. A record can play once, or go on repeat as the house's music:
// then it plays whenever the buddy is in the house, instead of the village song (which inside
// the house is only heard faintly, from outside: music.js muffleMusic). Each time round it
// fades out, rests a moment and starts again, so the loop never jumps. Its loudness is the
// kid's to set.
//
// Like the studio's mixes and tunes (studio-store.js), what's on repeat and how loud are kept
// on this tablet only, per kid (each kid has their own tablet user).
//
// app.js calls houseRecord() whenever it decides what music plays (syncMusic), and
// openTurntable() when the buddy walks up to it.

import { state, esc, kidById, toast, openModal, $modal } from './ctx.js';
import { musicContext, stopMusic } from './music.js';
import { loadMixes, loadTunes, loadTake } from './studio-store.js';
import { renderMix, renderTune } from './mixsound.js';
import { hasTurntable } from './furniture.js';
import { mixSeconds, MIX_SLOTS } from './studiorules.js';
import { tuneName, tuneAbout, TUNE_SLOTS } from './tunerules.js';

// ---------- the rules (no sound, no screen) ----------

/** A record on repeat: it fades out over its last `fadeOut` seconds, then `gap` seconds of quiet. */
export const LOOP = { fadeIn: 0.03, fadeOut: 0.5, gap: 1.5 };
export const VOL_TOP = 10;
export const VOL_START = 7;

/** The turntable's loudness knob (0 to VOL_TOP) as a gain: quieter steps near the bottom, as ears hear it. */
export const volGain = (v) => (Math.max(0, Math.min(VOL_TOP, v)) / VOL_TOP) ** 2;

/**
 * One time round of a record: its sound with a soft start, a fade over its last moments, and
 * (on repeat) a rest after it, so the next time round starts cleanly. samples: one channel.
 */
export function shapePass(samples, rate, { loop = false, fadeIn = LOOP.fadeIn, fadeOut = LOOP.fadeOut, gap = LOOP.gap } = {}) {
  const n = samples.length;
  const out = new Float32Array(n + (loop ? Math.round(gap * rate) : 0));
  out.set(samples);
  const fi = Math.min(Math.round(fadeIn * rate), Math.floor(n / 4));
  for (let i = 0; i < fi; i += 1) out[i] *= i / fi;
  const fo = Math.min(Math.round(fadeOut * rate), Math.floor(n / 3));
  for (let i = 0; i < fo; i += 1) out[n - 1 - i] *= i / fo;
  return out;
}

/** A record's key: 'mix:0' to 'mix:2' (the studio's kept mixes), 'desk' (the mix on the desk), 'tune:0' to 'tune:5'. */
export function validRecord(key) {
  if (key === 'desk') return true;
  const m = /^(mix|tune):(\d)$/.exec(String(key || ''));
  return Boolean(m) && Number(m[2]) < (m[1] === 'mix' ? MIX_SLOTS : TUNE_SLOTS);
}

const hasClips = (mix) => Boolean(mix?.tracks?.some((t) => t.length));

/**
 * What a kid can put on: [{ key, name, about, group: 'mix' | 'tune', data }] from their kept
 * mixes, the mix on the studio desk, and their kept tunes. mixes: studio-store.js loadMixes,
 * tunes: loadTunes.
 */
export function recordList(mixes, tunes) {
  const out = [];
  const secs = (s) => `${Math.max(1, Math.round(s))} second${Math.round(s) === 1 ? '' : 's'}`;
  (mixes?.slots || []).forEach((m, i) => {
    if (hasClips(m)) out.push({ key: `mix:${i}`, name: m.name || `Mix ${i + 1}`, about: `Studio mix, ${secs(mixSeconds(m))}`, group: 'mix', data: m });
  });
  if (hasClips(mixes?.draft)) out.push({ key: 'desk', name: 'On the studio desk', about: `Not kept yet, ${secs(mixSeconds(mixes.draft))}`, group: 'mix', data: mixes.draft });
  (tunes || []).forEach((t, i) => { if (t) out.push({ key: `tune:${i}`, name: tuneName(i), about: tuneAbout(t), group: 'tune', data: t }); });
  return out;
}

// ---------- what's kept on this tablet ----------

const KEY = 'kidquest.turntable';
function readAll(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { return {}; }
}

/** A kid's turntable: { loop: the record on repeat (a key) or null, vol: 0 to VOL_TOP }. */
export function deckOf(kidId, storage = globalThis.localStorage) {
  const d = readAll(storage)[kidId] || {};
  return { loop: validRecord(d.loop) ? d.loop : null, vol: Number.isInteger(d.vol) && d.vol >= 0 && d.vol <= VOL_TOP ? d.vol : VOL_START };
}

/** Change a kid's turntable (some of { loop, vol }). */
export function setDeck(kidId, change, storage = globalThis.localStorage) {
  const all = readAll(storage);
  all[kidId] = { ...deckOf(kidId, storage), ...change };
  try { storage?.setItem(KEY, JSON.stringify(all)); } catch { /* private window: it just isn't remembered */ }
}

// ---------- playing ----------

const T = {
  kid: '', key: '', mode: '', // what's on: the kid, the record, 'once' or 'loop'
  loading: false, // its sound is being made
  src: null, gain: null,
  token: 0,
  failed: new Set(), // `${kid}|${key}` that couldn't be played: not tried again by itself
};
const made = new Map(); // `${kid}|${key}|${sig}` -> Promise<AudioBuffer|null>, the last two
const watchers = new Set();
let sync = null; // app.js: decide the music again (a record ended or stopped)

/** app.js: what to call when the turntable stops or starts by itself, so the music is decided again. */
export function setTurntableSync(fn) { sync = fn; }

function changed() {
  for (const fn of watchers) fn();
  queueMicrotask(() => sync?.());
}

/** A short stand-in for a record's contents, so a changed mix or tune is made again. */
function sigOf(data) {
  const s = JSON.stringify(data);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}.${h.toString(36)}`;
}

async function findRecord(kidId, key) {
  const [mixes, tunes] = await Promise.all([loadMixes(kidId).catch(() => null), loadTunes(kidId).catch(() => [])]);
  return recordList(mixes, tunes).find((r) => r.key === key) || null;
}

/** A record's sound, made once (null when it is gone or can't be made). */
async function recordSound(kidId, key, rate) {
  const rec = await findRecord(kidId, key);
  if (!rec) return null;
  const id = `${kidId}|${key}|${sigOf(rec.data)}|${rate}`;
  if (!made.has(id)) {
    const job = (rec.group === 'tune' ? renderTune(rec.data, { rate }) : renderMix(rec.data, { rate, loadTake })).catch(() => null);
    made.set(id, job);
    while (made.size > 2) made.delete(made.keys().next().value);
  }
  const buf = await made.get(id);
  if (!buf) made.delete(id);
  return buf;
}

function stopSource() {
  const { src, gain } = T;
  T.src = null; T.gain = null;
  if (!src) return;
  src.onended = null;
  const ac = gain.context;
  const t = ac.currentTime;
  try {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.25);
    src.stop(t + 0.3);
  } catch { /* already stopped */ }
  setTimeout(() => { try { src.disconnect(); gain.disconnect(); } catch { /* gone */ } }, 500);
}

/** Put a record on: once, or on repeat ('loop'). */
export async function playRecord(kidId, key, mode = 'once') {
  const ac = musicContext();
  if (!ac || !validRecord(key)) return;
  const token = ++T.token;
  stopSource();
  Object.assign(T, { kid: kidId, key, mode, loading: true });
  T.failed.delete(`${kidId}|${key}`);
  stopMusic(); // the village song makes way
  changed();
  try { await ac.resume(); } catch { /* it starts on the next tap */ }
  const buf = await recordSound(kidId, key, ac.sampleRate);
  if (token !== T.token) return;
  T.loading = false;
  if (!buf) {
    T.failed.add(`${kidId}|${key}`);
    Object.assign(T, { kid: '', key: '', mode: '' });
    changed();
    return;
  }
  const pass = shapePass(buf.getChannelData(0), buf.sampleRate, { loop: mode === 'loop' });
  const b = ac.createBuffer(1, pass.length, buf.sampleRate);
  b.copyToChannel(pass, 0);
  const src = ac.createBufferSource();
  src.buffer = b;
  src.loop = mode === 'loop';
  const gain = ac.createGain();
  gain.gain.value = volGain(deckOf(kidId).vol);
  src.connect(gain).connect(ac.destination);
  src.start(ac.currentTime + 0.05);
  Object.assign(T, { src, gain });
  if (mode === 'once') {
    src.onended = () => {
      if (T.src !== src) return;
      stopSource();
      Object.assign(T, { kid: '', key: '', mode: '' });
      changed();
    };
  }
  changed();
}

/** Lift the needle: nothing plays (the house's music is decided again by app.js). */
export function stopRecord() {
  if (!T.kid && !T.src) return;
  T.token += 1;
  stopSource();
  Object.assign(T, { kid: '', key: '', mode: '', loading: false });
  for (const fn of watchers) fn();
}

/** The turntable's loudness changed: what's playing follows at once. */
export function setRecordVolume(kidId, vol) {
  const v = Math.max(0, Math.min(VOL_TOP, Math.round(vol)));
  setDeck(kidId, { vol: v });
  if (T.gain && T.kid === kidId) {
    const p = T.gain.gain;
    const t = T.gain.context.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(volGain(v), t + 0.08);
  }
}

/** What's on now: { kid, key, mode, loading } (key '' when nothing). */
export const nowPlaying = () => ({ kid: T.kid, key: T.key, mode: T.mode, loading: T.loading });

/** Whether this kid's record is going round (for the spinning record and the notes in the house). */
export const spinning = (kidId) => Boolean(T.src && T.kid === kidId);

/**
 * The house's music, from app.js each time it decides what plays: true when the turntable has
 * it (then the village song stays off), false when the village song should play (muffled).
 * inHouse: the buddy is in its own house and the kid's screen is showing, with sound on.
 */
export function houseRecord(kid, inHouse) {
  if (!kid || !inHouse || !hasTurntable(kid)) { stopRecord(); return false; }
  if (T.kid && T.kid !== kid.id) stopRecord();
  if (T.kid === kid.id && (T.src || T.loading)) return true;
  const { loop } = deckOf(kid.id);
  if (loop && !T.failed.has(`${kid.id}|${loop}`)) { playRecord(kid.id, loop, 'loop'); return true; }
  return false;
}

// ---------- the turntable's screen (a pop-up in the house) ----------

/** Open the turntable for a kid: their records, once or on repeat, and the loudness. */
export function openTurntable(kidId) {
  const kid = kidById(kidId);
  if (!kid) return;
  if (state.settings?.sound === false) { toast('The sound is off. A parent can turn it on in Settings.'); return; }
  let records = null;
  openModal(`<div class="tt" data-kid="${esc(kid.id)}">
    <div class="tt-top"><span class="tt-icon" aria-hidden="true">🎶</span><h2>Turntable</h2></div>
    <label class="tt-vol"><span aria-hidden="true">🔈</span><input type="range" min="0" max="${VOL_TOP}" step="1" value="${deckOf(kid.id).vol}" data-tt-vol aria-label="Turntable loudness"><span aria-hidden="true">🔊</span></label>
    <div class="tt-body"><p class="muted">Looking for your music…</p></div>
    <button class="btn" data-action="modal-close">Done</button>
  </div>`, () => watchers.delete(paint));
  const root = $modal.querySelector('.tt');

  function row(r, now) {
    const on = now.key === r.key && now.kid === kid.id;
    const looping = deckOf(kid.id).loop === r.key;
    const playingOnce = on && now.mode === 'once';
    return `<div class="tt-row ${on ? 'on' : ''}">
      <span class="tt-disc ${on && !now.loading ? 'spin' : ''}" aria-hidden="true"></span>
      <span class="tt-name"><b>${esc(r.name)}</b><small>${on && now.loading ? 'Getting it ready…' : esc(r.about)}</small></span>
      <button class="btn ghost small-btn" data-tt="${playingOnce ? 'stop' : 'once'}" data-key="${esc(r.key)}">${playingOnce ? '■ Stop' : '▶ Play once'}</button>
      <button class="btn ${looping ? '' : 'ghost'} small-btn" data-tt="loop" data-key="${esc(r.key)}" aria-pressed="${looping}">${looping ? '🔁 House music ✓' : '🔁 House music'}</button>
    </div>`;
  }
  function paint() {
    if (!root.isConnected) { watchers.delete(paint); return; }
    const body = root.querySelector('.tt-body');
    if (!records) return;
    const now = nowPlaying();
    const loop = deckOf(kid.id).loop;
    const playing = now.kid === kid.id && now.key ? records.find((r) => r.key === now.key) : null;
    const status = playing ? `${now.mode === 'loop' ? '🔁 On repeat' : '▶ Playing'}: <b>${esc(playing.name)}</b>` : loop && records.some((r) => r.key === loop) ? `🔁 House music: <b>${esc(records.find((r) => r.key === loop).name)}</b>` : '🌳 You can just hear the village music from outside.';
    const mixes = records.filter((r) => r.group === 'mix');
    const tunes = records.filter((r) => r.group === 'tune');
    body.innerHTML = records.length ? `
      <p class="tt-status">${status}</p>
      ${mixes.length ? `<h3>🎛️ Studio mixes</h3>${mixes.map((r) => row(r, now)).join('')}` : ''}
      ${tunes.length ? `<h3>🤖 Note-o-Matic tunes</h3>${tunes.map((r) => row(r, now)).join('')}` : ''}
      <p class="muted small">🔁 House music plays every time you're in your house. Tap it again to go back to the village music.</p>`
      : '<p class="tt-empty">No records yet! Make a mix in the recording studio, or keep a tune from the Note-o-Matic, in your music house. Then come back and play it here.</p>';
  }
  watchers.add(paint);

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tt]');
    if (!b) return;
    e.stopPropagation();
    const key = b.dataset.key;
    const what = b.dataset.tt;
    if (what === 'once') playRecord(kid.id, key, 'once');
    else if (what === 'stop') { stopRecord(); queueMicrotask(() => sync?.()); }
    else if (what === 'loop') {
      if (deckOf(kid.id).loop === key) {
        // back to the village music
        setDeck(kid.id, { loop: null });
        stopRecord();
        queueMicrotask(() => sync?.());
      } else {
        setDeck(kid.id, { loop: key });
        playRecord(kid.id, key, 'loop');
      }
    }
    paint();
  });
  root.querySelector('[data-tt-vol]').addEventListener('input', (e) => setRecordVolume(kid.id, Number(e.target.value)));

  Promise.all([loadMixes(kid.id).catch(() => null), loadTunes(kid.id).catch(() => [])]).then(([mixes, tunes]) => {
    records = recordList(mixes, tunes);
    // a record on repeat that's gone from the studio is taken off
    const { loop } = deckOf(kid.id);
    if (loop && !records.some((r) => r.key === loop)) setDeck(kid.id, { loop: null });
    paint();
  });
}
