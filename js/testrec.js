// Settings › Save a test recording (behind the parent PIN): a parent records up to 2 minutes
// of piano through the tablet's microphone and saves it as a sound file (a plain WAV, through
// the browser's download), for trying out sound tools outside the game. The microphone is
// opened and heard exactly as in the recording studio (mic.js), so the sound is the same as a
// kid's take before the studio works on it. The sound is kept as it came: one channel, the
// microphone's own sample rate, 16 bits, nothing made louder or cut. Nothing is kept in the
// game: no app state, no family sync, none of the studio's storage.
//
// app.js draws a fixed card in Settings with an empty #rec-test; mountTestRec() fills it from
// what is kept here after each redraw, and stops a recording when the card is gone.

import { esc } from './ctx.js';
import { stopMusic } from './music.js';
import { openMic, capture } from './mic.js';
import { joinBlocks, wavBytes, recordingName } from './studio-audio.js';

const SAY = {
  refused: 'The microphone isn\'t allowed. Allow the microphone for this app in Chrome\'s site settings, then try again.',
  noMic: 'I can\'t find a microphone on this tablet.',
  micBroken: 'The microphone isn\'t working right now. Try again in a moment.',
  cantRecord: 'This tablet can\'t record here. Try updating Chrome.',
  hidden: 'The recording stopped because the app was put away. Nothing was saved.',
  micStopped: 'The microphone stopped, so the recording stopped. Nothing was saved.',
  cantSave: 'I couldn\'t make the sound file. Please try again.',
  shareFailed: 'I couldn\'t share the file. Use Save it again instead.',
  tooLoud: 'Too loud: move the tablet back a little.',
};

/** The longest recording, in seconds: long enough for every key of the piano, one at a time.
 * A test can make it shorter (`REC.most = 2`). */
export const REC = { most: 120 };

const FULL = 0.999;  // a sample this loud has reached full scale
const LOUD_FOR = 2;  // seconds the "too loud" warning stays after the last loud sample
const QUIET_DB = 60; // the loudness bar starts this many decibels under full scale
const FALL_DB = 3;   // and falls back by this much each time it is drawn (about ten times a second)

const R = {
  label: '',
  run: null,   // a recording: { token, ac, stream, cap, at (Date), frames, peak, loudAt, live }
  token: 0,    // bumped by every stop, so a microphone that opens late is closed again
  saved: null, // the last file: { name, url, file }
  note: '',    // a plain message under the button
  noteKind: '',
};
let wake = null; // the screen's wake lock while recording

/** After each redraw: fill the card when Settings shows it, or stop when it's gone. */
export function mountTestRec(root) {
  const el = root.querySelector('#rec-test');
  if (!el) { if (R.run || R.saved || R.note) leave(); return; }
  if (el.dataset.live) return;
  el.dataset.live = '1';
  el.innerHTML = `
    <label class="block">What is this? (it goes in the file name)
      <input type="text" data-rec-label maxlength="80" placeholder="c major scale" autocomplete="off" value="${esc(R.label)}"></label>
    <div class="rec-body"></div>`;
  el.querySelector('[data-rec-label]').addEventListener('input', (e) => { R.label = e.target.value; });
  el.addEventListener('click', onClick);
  paint();
}

/** The parent left Settings: stop, let the microphone go, forget the file. */
function leave() {
  stop('');
  forget();
  R.note = '';
}

/** Is a recording under way (or the microphone opening)? For tests: { recording, saved }. */
export function testRecState() {
  return { recording: Boolean(R.run), saved: R.saved?.name || '' };
}

function onClick(e) {
  const b = e.target.closest('[data-rec]');
  if (!b) return;
  const what = b.dataset.rec;
  if (what === 'go') {
    if (R.run) finish();
    else start().catch(() => { if (R.run) fail(SAY.micBroken); });
  }
  if (what === 'share') share();
}

// ---------- drawing ----------

const body = () => document.querySelector('#rec-test .rec-body');

function paint() {
  const el = body();
  if (!el) return;
  const run = R.run;
  const s = R.saved;
  el.innerHTML = `
    <div class="row wrap"><button class="btn${run ? ' danger' : ''}" data-rec="go">${run ? '■ Stop' : '● Record'}</button></div>
    ${run ? `
    <p class="rec-time" aria-live="polite"></p>
    <div class="rec-meter" aria-hidden="true"><span></span></div>
    <p class="rec-warn small" hidden>${esc(SAY.tooLoud)}</p>` : ''}
    ${!run && s ? `
    <p class="rec-saved">Saved <b>${esc(s.name)}</b>. Look in this tablet's Downloads.</p>
    <div class="row wrap">
      <a class="btn ghost" href="${esc(s.url)}" download="${esc(s.name)}" data-rec="again">Save it again</a>
      ${canShare(s.file) ? '<button class="btn ghost" data-rec="share">Share…</button>' : ''}
    </div>` : ''}
    ${R.note ? `<p class="rec-note small ${R.noteKind}">${esc(R.note)}</p>` : ''}`;
  if (run) live();
}

/** The seconds so far, the loudness bar and the warning, without redrawing the button. */
function live() {
  const run = R.run;
  const el = body();
  if (!run?.ac || !el) return;
  const rate = run.ac.sampleRate;
  const time = el.querySelector('.rec-time');
  if (time) time.textContent = `${clock(run.frames / rate)} of ${clock(REC.most)}`;
  const bar = el.querySelector('.rec-meter span');
  // the bar falls back slowly, so a short loud note can be seen
  const db = Math.max(run.peak > 0 ? 20 * Math.log10(run.peak) : -QUIET_DB, (run.shown ?? -QUIET_DB) - FALL_DB);
  run.shown = db;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, ((db + QUIET_DB) / QUIET_DB) * 100)).toFixed(1)}%`;
  const warn = el.querySelector('.rec-warn');
  if (warn) warn.hidden = !(run.loudAt >= 0 && run.frames - run.loudAt < LOUD_FOR * rate);
  run.peak = 0; // the bar shows the loudest sound since it was last drawn
}

/** Seconds as minutes and seconds: 75 -> '1:15'. */
function clock(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function canShare(file) {
  try { return Boolean(navigator.canShare?.({ files: [file] })); } catch { return false; }
}

function say(text, kind = '') {
  R.note = text;
  R.noteKind = kind;
}

// ---------- recording ----------

/** Why the microphone didn't open, in plain words. */
function micTrouble(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return SAY.refused;
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' || e?.name === 'NotSupported') return SAY.noMic;
  return SAY.micBroken;
}

/** A sound clock at the microphone's own sample rate (or the tablet's usual one). */
function contextFor(stream) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const rate = stream.getAudioTracks()[0]?.getSettings?.().sampleRate;
  if (rate) { try { return new AC({ sampleRate: rate }); } catch { /* the usual rate then */ } }
  return new AC();
}

async function start() {
  stopMusic(); // nothing of the game's plays over a recording
  forget(); // a new recording replaces the last file
  const token = ++R.token;
  const run = { token, ac: null, stream: null, cap: null, at: new Date(), frames: 0, peak: 0, loudAt: -1, heardAt: 0, check: 0 };
  R.run = run;
  say('');
  paint();
  keepAwake();
  try {
    run.stream = await openMic();
  } catch (e) {
    if (R.run === run) fail(micTrouble(e));
    return;
  }
  if (R.run !== run) { run.stream.getTracks().forEach((t) => t.stop()); return; } // stopped meanwhile
  try {
    run.ac = contextFor(run.stream);
    await run.ac.resume();
    const cap = await capture(run.ac, run.stream, (block) => heard(run, block));
    if (R.run !== run) { cap.stop(); closeAc(run); return; }
    run.cap = cap;
  } catch {
    if (R.run === run) fail(SAY.cantRecord);
    else { run.stream.getTracks().forEach((t) => t.stop()); closeAc(run); }
    return;
  }
  run.at = new Date();
  run.heardAt = performance.now();
  run.stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => { if (R.run === run) fail(SAY.micStopped); }));
  // the sound clock may stop (another app takes the sound): never leave a stuck Stop
  run.check = setInterval(() => {
    if (R.run === run && performance.now() - run.heardAt > 3000) fail(SAY.micBroken);
  }, 500);
  live();
}

/** A block from the microphone: count it, watch how loud it is, stop at the limit. */
function heard(run, block) {
  if (R.run !== run) return;
  run.heardAt = performance.now();
  const s = block.samples;
  const before = run.frames;
  run.frames += s.length;
  for (let i = 0; i < s.length; i += 1) {
    const a = Math.abs(s[i]);
    if (a > run.peak) run.peak = a;
    if (a >= FULL) run.loudAt = before + i;
  }
  if (run.frames >= REC.most * run.ac.sampleRate) { finish(); return; }
  // about ten times a second is enough for the eye
  if (Math.floor(run.frames / (run.ac.sampleRate / 10)) !== Math.floor(before / (run.ac.sampleRate / 10))) live();
}

/** Stop and save the file (Stop, or the limit reached). */
function finish() {
  const run = R.run;
  if (!run) return;
  if (!run.cap) { stop(''); paint(); return; } // the microphone wasn't open yet: nothing to save
  const rate = run.ac.sampleRate;
  const blocks = run.cap.blocks;
  stop('');
  try {
    const { samples } = joinBlocks(blocks);
    const most = Math.round(REC.most * rate);
    const sound = samples.length > most ? samples.subarray(0, most) : samples;
    const name = recordingName(R.label, run.at);
    const file = new File([wavBytes(sound, rate)], name, { type: 'audio/wav' });
    R.saved = { name, url: URL.createObjectURL(file), file };
    download(R.saved);
  } catch {
    forget();
    say(SAY.cantSave, 'bad');
  }
  paint();
}

/** The recording stopped by itself (the app put away, the microphone gone, a failure). */
function fail(text) {
  stop(text, 'bad');
  paint();
}

/** End a recording without saving: let the microphone, the sound clock and the screen go. */
function stop(text, kind = '') {
  const run = R.run;
  R.token += 1;
  R.run = null;
  if (run) {
    clearInterval(run.check);
    if (run.cap) run.cap.stop();
    else run.stream?.getTracks().forEach((t) => t.stop());
    closeAc(run);
  }
  letSleep();
  if (text) say(text, kind);
}

function closeAc(run) {
  run.ac?.close?.().catch(() => {});
  run.ac = null;
}

/** Forget the last file. */
function forget() {
  if (R.saved) URL.revokeObjectURL(R.saved.url);
  R.saved = null;
}

/** Hand the file to the browser's download. */
function download({ url, name }) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
}

async function share() {
  const s = R.saved;
  if (!s) return;
  try {
    await navigator.share({ files: [s.file], title: s.name });
  } catch (e) {
    if (e?.name === 'AbortError') return; // the parent closed the share sheet
    say(SAY.shareFailed, 'bad');
    paint();
  }
}

// ---------- the screen stays on while recording ----------

function keepAwake() {
  if (wake || !navigator.wakeLock?.request) return;
  const asking = navigator.wakeLock.request('screen').then((lock) => {
    if (wake !== asking) { lock.release?.().catch(() => {}); return null; }
    return lock;
  }).catch(() => null);
  wake = asking;
}

function letSleep() {
  const asking = wake;
  wake = null;
  asking?.then((lock) => lock?.release?.().catch(() => {}));
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && R.run) fail(SAY.hidden);
});
