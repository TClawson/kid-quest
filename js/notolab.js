// The Note-o-Matic robot's own screen in the music house: a kid plays the piano to the robot
// (no clicks, no count-in, up to LAB.most seconds), it listens (hearnotes.js, away from the
// screen) and shows three readings of the playing (notomatic.js tuneReadings): as heard,
// tidied and with a band. The kid listens to each, picks a voice and an octave, and keeps one
// on a shelf of TUNE_SLOTS tunes (tunerules.js, kept on the tablet by studio-store.js), which
// the recording studio's shelf shows too. The recording itself is kept only in memory while
// the screen is open. Parents get a test desk from Settings (behind the PIN), whose tunes are
// the test studio's: no kid's tunes are touched.
//
// app.js draws viewLab() and calls mountLab() after each redraw: it fills #lab from the state
// kept here, and lets everything go when the screen is gone. Stages: ready, rec, listen, pick.

import { ui, state, esc, kidById, render, viewKid, today, toast } from './ctx.js';
import { labOpen } from './musicrules.js';
import { stopMusic, renderEvents } from './music.js';
import { openMic, capture } from './mic.js';
import { joinBlocks, normalise, peakOf, SILENT } from './studio-audio.js';
import { hearNotes } from './hearnotes.js';
import { READINGS, tuneReadings } from './notomatic.js';
import { VOICES, VOICE_IDS } from './studiokit.js';
import { READING_VOICES, roleLevel } from './studiorules.js';
import { TUNE_SLOTS, TUNE_BPM, stepSpeed, makeTune, startVoice, shiftFits, tuneName, tuneAbout, freeSlot } from './tunerules.js';
import { loadTunes, saveTune, deleteTune } from './studio-store.js';

export const LAB_MOST = 30;
/** How long a save or a throw-away may take before the kid is told it didn't work (ms). */
export const KEEP_WAIT = 8000;
/**
 * The longest recording, in seconds, and how long to wait for the tablet to keep a tune. A
 * test can make them shorter (`LAB.most = 2`, `LAB.wait = 500`).
 */
export const LAB = { most: LAB_MOST, wait: KEEP_WAIT };

/** Answers a promise's result as { ok }, or LATE when it takes longer than `ms` (it may still land). */
const LATE = Symbol('late');
function inTime(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(LATE), ms);
    p.then((ok) => { clearTimeout(t); resolve({ ok }); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** The test desk's id: the same as the test studio's, so its tunes show on that shelf. */
const TEST_DESK = 'parent-test';
const LEAST_NOTES = 3;
// Seconds cut from the end of a recording the kid stopped, counted back from the finger landing
// on Stop: the tablet sits on the piano, so that tap is a knock in the recording (heard as a last
// note), and the microphone hears it a moment late.
const STOP_CUT = 0.1;
const DOWN_FRESH = 1500; // ms: a finger that landed longer ago than this isn't the one pressing Stop
const SHORTEST = 0.3;    // seconds: a recording shorter than this has nothing to hear

const ROBOT = {
  ready: 'Beep boop! Play me something on the piano and I\'ll turn it into notes.',
  rec: 'I\'m listening… Press Stop when you\'re done.',
  listen: 'Thinking… beep… boop…',
  pick: 'Here is what I heard! Listen to each one and pick your favorite.',
  nothing: 'I couldn\'t hear piano notes in that. Try again a bit closer to the piano.',
  saved: 'Saved! You\'ll find it on the shelf in the recording studio too.',
  thrown: 'Okay, it\'s gone.',
  thrownPick: 'Okay, it\'s gone. Now you can keep your tune.',
  full: 'Beep boop! My tune shelf is full. You can still play to me, and throw a tune away to keep a new one.',
};

const SAY = {
  refused: 'The microphone isn\'t allowed. Ask a grown-up to allow the microphone for this app, then try again.',
  noMic: 'I can\'t find a microphone on this tablet.',
  micBroken: 'The microphone isn\'t working right now. Try again in a moment.',
  cantRecord: 'This tablet can\'t record here. Try updating Chrome.',
  hidden: 'The recording stopped because the app was put away. Nothing was kept.',
  micStopped: 'The microphone stopped, so the recording stopped. Nothing was kept.',
  broken: 'Oops, my gears got stuck. Please try again.',
  full: 'Your tune shelf is full. Throw one away to keep a new one.',
  cantKeep: 'I couldn\'t keep it on this tablet. Please try again.',
  cantThrow: 'I couldn\'t throw it away. Please try again.',
  tooLoud: 'Too loud: move the tablet back a little.',
  soundOff: 'Sounds are turned off in Settings.',
  noSound: 'This tablet can\'t play sound here.',
  cantPlay: 'I couldn\'t play that. Please try again.',
  highest: 'That\'s as high as it goes.',
  lowest: 'That\'s as low as it goes.',
};

const FULL = 0.999;  // a sample this loud has reached full scale
const LOUD_FOR = 2;  // seconds the "too loud" warning stays after the last loud sample
const QUIET_DB = 60; // the loudness bar starts this many decibels under full scale
const FALL_DB = 3;   // and falls back by this much each time it is drawn

// ---------- what the screen remembers while the app is open ----------

const L = {
  on: false,
  desk: null,       // whose tunes: a kid's id or TEST_DESK
  shelf: null,      // [tune|null × TUNE_SLOTS], null while loading
  stage: 'ready',   // 'ready', 'rec', 'listen' or 'pick'
  robot: '',        // what the robot says instead of the stage's usual line
  note: '',         // a plain message under the buttons
  noteKind: '',
  confirm: -1,      // the slot asking "Throw away?"
  keeping: false,   // a tune on its way to the tablet: nothing may drop it meanwhile
  late: null,       // a save that took too long and may still land: { desk, res, slot, id }
  throwing: new Set(), // slots on their way out
  run: null,        // a recording: { token, ac, stream, cap, frames, peak, loudAt, heardAt, check }
  token: 0,
  job: null,        // the listening (hearnotes.js)
  progress: 0,
  sound: null,      // the recording: { samples, rate } (in memory only)
  kept: 0,          // how long the recording kept is, in seconds (for tests)
  heard: null,      // what was heard in it (listener.js notes)
  result: null,     // tuneReadings
  bpm: 0,           // the tune's speed as the kid wants it (it starts at the speed the robot found)
  pick: 'tidy',
  how: {},          // reading id -> { voice, shift }
  hearing: '',      // what plays: '', 'raw', a reading id, or 'slot|N'
  waiting: '',      // the same while its sound is being made
  made: new Map(),  // sounds made: key -> Promise<AudioBuffer[]|null>
};
const A = { ac: null, sources: [], timer: 0 };
let wake = null;

const deskId = () => (ui.labTest ? TEST_DESK : ui.kidId);

/** Who uses the screen: { open, back, title, color } or null. */
function deskOf(id) {
  if (id === TEST_DESK) return { open: true, back: { view: 'parent', tab: 'settings' }, backLabel: 'Back to Settings', title: 'Test desk', color: '#868e96' };
  const kid = kidById(id);
  if (!kid) return null;
  return { open: labOpen(state, kid, today()).open, back: { view: 'kid' }, backLabel: 'Back to the music house', title: kid.name, color: kid.color };
}

// ---------- the screen ----------

export function viewLab() {
  const id = deskId();
  const desk = deskOf(id);
  if (!desk?.open) { ui.labTest = false; ui.view = 'kid'; return viewKid(); }
  return `
    <div class="screen lab-screen" style="--kid:${esc(/^#[0-9a-f]{6}$/i.test(desk.color || '') ? desk.color : '#e03131')}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="lab-back" aria-label="${esc(desk.backLabel)}">←</button>
        <div class="kid-title"><b>🤖 Note-o-Matic</b><small>${esc(desk.title)}</small></div>
      </header>
      <div id="lab" class="lab" data-desk="${esc(id)}"><p class="muted">Waking up the robot…</p></div>
    </div>`;
}

/** After each redraw: fill the screen when it is there, or let everything go when it's gone. */
export function mountLab(root) {
  const el = root.querySelector('#lab');
  if (!el) { if (L.on) leave(); return; }
  if (el.dataset.live) return;
  el.dataset.live = '1';
  L.on = true;
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  if (L.desk !== el.dataset.desk) openDesk(el.dataset.desk);
  else paint();
}

async function openDesk(id) {
  reset();
  L.desk = id;
  L.shelf = null;
  paint();
  const shelf = await loadTunes(id).catch(() => Array(TUNE_SLOTS).fill(null));
  if (L.desk !== id) return;
  L.shelf = shelf;
  paint();
}

/** The screen went away: stop recording, listening and playing; forget the recording; close the sound. */
function leave() {
  reset();
  L.on = false;
  L.desk = null;
  // the sound clock for listening goes too (audio() makes a new one next time)
  const ac = A.ac;
  A.ac = null;
  ac?.close?.().catch(() => {});
}

/** Back to Ready with nothing under way. */
function reset() {
  stopRec('');
  stopListening();
  stopSound(false);
  forget();
  L.stage = 'ready';
  L.robot = '';
  L.confirm = -1;
  say('');
  updateWake(); // (nothing under way: the screen may sleep)
}

function forget() {
  L.sound = null;
  L.heard = null;
  L.result = null;
  L.bpm = 0;
  L.how = {};
  L.made.clear();
}

function say(text, kind = '') {
  L.note = text;
  L.noteKind = kind;
}

const body = () => document.querySelector('#lab');

function paint() {
  const el = body();
  if (!el) return;
  const line = robotLine();
  el.innerHTML = `
    <div class="lab-robot"><span class="lab-bot" aria-hidden="true">🤖</span><p class="lab-bubble" role="status">${esc(line)}</p></div>
    ${{ ready: readyHtml, rec: recHtml, listen: listenHtml, pick: pickHtml }[L.stage]()}
    ${L.note ? `<p class="lab-note ${L.noteKind}" role="alert">${esc(L.note)}</p>` : ''}
    ${L.stage === 'ready' || (L.stage === 'pick' && shelfFull()) ? shelfHtml() : ''}`;
  if (L.stage === 'rec') live();
}

const shelfFull = () => Boolean(L.shelf) && freeSlot(L.shelf) < 0;

/** What the robot says: news, else the stage's line (on Ready with a full shelf, that it is full). */
function robotLine() {
  if (L.robot) return L.robot;
  return L.stage === 'ready' && shelfFull() ? ROBOT.full : ROBOT[L.stage];
}

function readyHtml() {
  return '<div class="lab-go"><button class="btn lab-rec" data-lab="rec">● Record</button></div>';
}

function recHtml() {
  return `<div class="lab-go">
      <p class="lab-time" aria-live="polite"></p>
      <div class="lab-meter" aria-hidden="true"><span></span></div>
      <p class="lab-warn" hidden>${esc(SAY.tooLoud)}</p>
      <button class="btn danger lab-rec" data-lab="stop">■ Stop</button>
    </div>`;
}

function listenHtml() {
  const p = Math.round(L.progress * 100);
  return `<div class="lab-go">
      <div class="st-progress lab-progress" role="progressbar" aria-label="How far I got" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="width:${p}%"></i></div>
      <button class="btn ghost lab-stop" data-lab="cancel">■ Stop</button>
    </div>`;
}

/** A Listen button: what it says while it plays, gets ready, or waits. */
function hearButton(key, label, extra = '') {
  const on = L.hearing === key;
  const face = !on ? label : L.waiting === key ? '⏳ Getting ready' : '■ Stop';
  return `<button class="btn ghost lab-hear ${on ? 'on' : ''}" data-lab="hear" data-what="${esc(key)}" aria-pressed="${on}" ${extra}>${face}</button>`;
}

function pickHtml() {
  const res = L.result;
  const cards = READINGS.filter((r) => res[r.id]).map((r) => {
    const on = L.pick === r.id;
    const how = L.how[r.id];
    const voices = VOICE_IDS.map((v) => `<option value="${v}" ${how.voice === v ? 'selected' : ''}>${VOICES[v].icon} ${esc(VOICES[v].name)}</option>`).join('');
    return `<div class="lab-card ${on ? 'on' : ''}" data-reading="${r.id}">
        <button class="lab-pick" data-lab="pick" data-reading="${r.id}" role="radio" aria-checked="${on}"><b>${esc(r.name)}</b><small>${esc(r.about)}</small></button>
        ${hearButton(r.id, '▶ Listen')}
        <label class="lab-voice">Voice <select data-lab-voice="${r.id}">${voices}</select></label>
        <div class="lab-octave">
          <button class="btn ghost" data-lab="shift" data-reading="${r.id}" data-d="12" aria-label="An octave higher">⬆ Higher</button>
          <button class="btn ghost" data-lab="shift" data-reading="${r.id}" data-d="-12" aria-label="An octave lower">⬇ Lower</button>
        </div>
      </div>`;
  }).join('');
  // 3 or 4 beats in a bar, in kid words: it changes every reading, and is kept with the tune
  const count = [[3, '1-2-3', 'Three beats in a bar'], [4, '1-2-3-4', 'Four beats in a bar']].map(([m, face, label]) => (
    `<button class="btn ghost lab-bar ${res.meter === m ? 'on' : ''}" data-lab="meter" data-meter="${m}" aria-label="${label}" aria-pressed="${res.meter === m}">${face}</button>`)).join('');
  return `<div class="lab-row">${hearButton('raw', '🎙️ Hear my recording')}</div>
    <div class="lab-count" role="group" aria-labelledby="lab-count-q"><span id="lab-count-q">How does your tune count?</span><div class="lab-bars">${count}</div></div>
    ${speedHtml()}
    <div class="lab-cards" role="radiogroup" aria-label="How your notes can be written">${cards}</div>
    <div class="lab-row lab-keep-row">
      <button class="btn lab-keep" data-lab="keep" ${L.keeping ? 'disabled aria-busy="true"' : ''}>${L.keeping ? '⏳ Keeping it…' : '✓ Keep this tune'}</button>
      <button class="btn ghost" data-lab="over" ${L.keeping ? 'disabled' : ''}>↺ Start over</button>
    </div>`;
}

/** The tune's speed: Slower, the number, Faster (for every reading, and what Keep keeps). */
function speedHtml() {
  const bpm = L.bpm;
  const btn = (d, face, label, end) => `<button class="btn ghost lab-speed-btn ${end ? 'off' : ''}" data-lab="speed" data-d="${d}" aria-label="${label}" ${end ? 'aria-disabled="true"' : ''}>${face}</button>`;
  return `<div class="lab-speed" role="group" aria-labelledby="lab-speed-name"><span id="lab-speed-name">Speed</span>
      ${btn(-1, '🐢 Slower', 'Slower', bpm <= TUNE_BPM[0])}
      <span class="lab-speed-val" aria-live="polite"><b>${bpm}</b><small>beats a minute</small></span>
      ${btn(1, '🐇 Faster', 'Faster', bpm >= TUNE_BPM[1])}
    </div>`;
}

function shelfHtml() {
  if (!L.shelf) return '<section class="lab-shelf"><h3>My tunes</h3><p class="muted">Looking for your tunes…</p></section>';
  const slots = L.shelf.map((t, i) => {
    if (!t) return `<li class="lab-slot empty"><b>${esc(tuneName(i))}</b><small>Empty</small></li>`;
    const ask = L.confirm === i
      ? `<span class="lab-ask">Throw away?</span>
         <button class="btn danger" data-lab="throw-yes" data-slot="${i}">Yes</button>
         <button class="btn ghost" data-lab="throw-no">No</button>`
      : `${hearButton(`slot|${i}`, '▶ Listen')}
         <button class="btn ghost" data-lab="throw" data-slot="${i}">🗑️ Throw away</button>`;
    return `<li class="lab-slot" data-slot="${i}"><b>${esc(tuneName(i))}</b><small>${esc(tuneAbout(t))} · ${esc(VOICES[t.voice]?.name || '')}</small>
        <div class="lab-slot-buttons">${ask}</div></li>`;
  }).join('');
  return `<section class="lab-shelf"><h3>My tunes</h3><ul class="lab-slots">${slots}</ul></section>`;
}

/** The seconds so far, the loudness bar and the warning, without drawing the rest again. */
function live() {
  const run = L.run;
  const el = body();
  if (!run || !el) return;
  const rate = run.ac?.sampleRate || 48000;
  const time = el.querySelector('.lab-time');
  if (time) time.textContent = `${clock(run.frames / rate)} of ${clock(LAB.most)}`;
  const bar = el.querySelector('.lab-meter span');
  const db = Math.max(run.peak > 0 ? 20 * Math.log10(run.peak) : -QUIET_DB, (run.shown ?? -QUIET_DB) - FALL_DB);
  run.shown = db;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, ((db + QUIET_DB) / QUIET_DB) * 100)).toFixed(1)}%`;
  const warn = el.querySelector('.lab-warn');
  if (warn) warn.hidden = !(run.loudAt >= 0 && run.frames - run.loudAt < LOUD_FOR * rate);
  run.peak = 0;
}

function clock(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- taps ----------

/** A finger landing on Stop: the recording ends there (see STOP_CUT), not when the tap is done. */
function onDown(e) {
  if (L.run && e.target.closest('[data-lab="stop"]')) L.run.down = { frames: L.run.frames, t: performance.now() };
}

function onClick(e) {
  const b = e.target.closest('[data-lab]');
  if (!b || b.disabled) return;
  const what = b.dataset.lab;
  // while a tune is being kept, nothing that would drop it or change it
  if (L.keeping && !['hear', 'throw-no'].includes(what)) return;
  if (what === 'rec') { startRec().catch(() => { if (L.run) failRec(SAY.micBroken); }); return; }
  if (what === 'stop') { finishRec(true); return; }
  if (what === 'cancel') { stopListening(); L.stage = 'ready'; L.robot = ''; forget(); paint(); updateWake(); return; }
  if (what === 'hear') { hear(b.dataset.what); return; }
  if (what === 'pick') { L.pick = b.dataset.reading; paint(); return; }
  if (what === 'shift') { shift(b.dataset.reading, Number(b.dataset.d)); return; }
  if (what === 'meter') { reread(Number(b.dataset.meter)); return; }
  if (what === 'speed') { speed(Number(b.dataset.d)); return; }
  if (what === 'keep') { keep(); return; }
  if (what === 'over') { stopSound(false); forget(); L.stage = 'ready'; L.robot = ''; say(''); paint(); return; }
  if (what === 'throw') { stopSound(false); L.confirm = Number(b.dataset.slot); L.robot = ''; say(''); paint(); return; }
  if (what === 'throw-no') { L.confirm = -1; paint(); return; }
  if (what === 'throw-yes') throwAway(Number(b.dataset.slot));
}

function onChange(e) {
  const sel = e.target.closest('[data-lab-voice]');
  if (!sel || !L.result || L.keeping) return;
  const id = sel.dataset.labVoice;
  if (!L.how[id] || !Object.hasOwn(VOICES, sel.value)) return;
  L.how[id].voice = sel.value;
  L.pick = id;
  replay(id);
}

/** A reading's sound changed: play it again when it was playing. */
function replay(id) {
  if (L.hearing === id) { stopSound(false); hear(id); } else paint();
}

function shift(id, d) {
  const how = L.how[id];
  const parts = L.result?.[id];
  if (!how || !parts) return;
  L.pick = id;
  const to = how.shift + d;
  if (!shiftFits(parts, to)) { toast(d > 0 ? SAY.highest : SAY.lowest); paint(); return; }
  how.shift = to;
  replay(id);
}

/** The tune a step slower or faster: a reading that plays starts again at the new speed. */
function speed(d) {
  if (!L.result) return;
  const to = stepSpeed(L.bpm, d);
  if (to === L.bpm) return; // (at the end already: the button is off)
  L.bpm = to;
  // (my recording itself and a tune on the shelf keep their own speed)
  if (L.result[L.hearing]) { const key = L.hearing; stopSound(false); hear(key); } else paint();
}

/** Read the playing again counting in 3s or 4s (the readings all change). */
function reread(meter) {
  if (!L.heard || L.result?.meter === meter) return;
  stopSound(false);
  L.made.clear();
  L.result = tuneReadings(L.heard, { meter });
  for (const r of READINGS) {
    const how = L.how[r.id] || { voice: startVoice(r.id), shift: 0 };
    if (L.result[r.id] && !shiftFits(L.result[r.id], how.shift)) how.shift = 0;
    L.how[r.id] = how;
  }
  if (!L.result[L.pick]) L.pick = 'tidy';
  paint();
}

async function keep() {
  const res = L.result;
  if (!res || L.stage !== 'pick' || L.keeping) return;
  const tune = makeTune({ ...res, bpm: L.bpm || res.bpm }, L.pick, L.how[L.pick]);
  if (!tune) { say(SAY.broken, 'bad'); paint(); return; }
  const desk = L.desk;
  L.keeping = true;
  paint();
  const cant = () => { L.keeping = false; if (L.desk === desk) { say(SAY.cantKeep, 'bad'); paint(); } };
  // A save that took too long may have landed since: read the shelf again first (the tablet
  // answers after that save is done), so the same tune is never kept twice.
  if (L.late?.desk === desk) {
    let got;
    try { got = await inTime(loadTunes(desk), LAB.wait); } catch { got = LATE; }
    if (got === LATE) { cant(); return; }
    if (L.desk !== desk) { L.keeping = false; return; }
    L.shelf = got.ok;
    const was = L.late;
    L.late = null;
    if (was.res === res && got.ok.some((t) => t?.id === was.id)) { L.keeping = false; saved(); return; }
  }
  const slot = freeSlot(L.shelf || []);
  if (slot < 0) { L.keeping = false; L.robot = SAY.full; paint(); return; }
  const saving = saveTune(desk, slot, tune);
  let got;
  try { got = await inTime(saving, LAB.wait); } catch { cant(); return; }
  if (got === LATE) {
    // the tablet is slow: the kid may try again or go; if it lands after all, the shelf shows it
    const late = { desk, res, slot, id: tune.id };
    L.late = late;
    saving.then(() => {
      if (L.late === late) L.late = null;
      if (L.desk !== desk || !L.shelf || L.keeping) return; // (a new Keep reads the shelf again)
      L.shelf[slot] = tune;
      if (L.result === res && L.stage === 'pick') saved();
      else { if (L.note === SAY.cantKeep) say(''); paint(); }
    }, () => { if (L.late === late) L.late = null; });
    cant();
    return;
  }
  L.keeping = false;
  if (L.desk !== desk) return; // (the screen closed: the shelf is read again when it opens)
  if (L.shelf) L.shelf[slot] = tune; // whatever happened meanwhile, the shelf shows what is kept
  if (L.result !== res || L.stage !== 'pick') { paint(); return; }
  saved();
}

/** The tune was kept: back to the start, and the robot says so. */
function saved() {
  stopSound(false);
  forget();
  L.stage = 'ready';
  L.robot = ROBOT.saved;
  say('');
  paint();
}

async function throwAway(slot) {
  const desk = L.desk;
  if (L.throwing.has(slot) || !L.shelf?.[slot]) return; // (a second tap on Yes)
  L.throwing.add(slot);
  L.confirm = -1;
  if (L.hearing === `slot|${slot}`) stopSound(false);
  paint();
  const going = deleteTune(desk, slot);
  let got;
  try { got = await inTime(going, LAB.wait); } catch { got = null; }
  L.throwing.delete(slot);
  if (!got || got === LATE) {
    // (if it is thrown away after all, the shelf says so then)
    if (got === LATE) {
      going.then(() => {
        if (L.desk !== desk || !L.shelf) return;
        L.shelf[slot] = null;
        // (the "couldn't throw it away" said meanwhile is no longer true)
        if (L.note === SAY.cantThrow) { say(''); L.robot = L.stage === 'pick' ? ROBOT.thrownPick : ROBOT.thrown; }
        paint();
      }, () => {});
    }
    if (L.desk === desk) { say(SAY.cantThrow, 'bad'); paint(); }
    return;
  }
  if (L.desk !== desk || !L.shelf) return; // (the screen closed or is reading the shelf again)
  L.shelf[slot] = null;
  L.robot = L.stage === 'pick' ? ROBOT.thrownPick : ROBOT.thrown;
  paint();
}

// ---------- recording ----------

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

async function startRec() {
  if (L.run || L.stage !== 'ready') return;
  stopMusic(); // nothing of the game's plays over a recording
  stopSound(false);
  forget();
  const token = ++L.token;
  const run = { token, ac: null, stream: null, cap: null, frames: 0, peak: 0, loudAt: -1, heardAt: 0, check: 0 };
  L.run = run;
  L.stage = 'rec';
  L.robot = '';
  L.confirm = -1;
  say('');
  paint();
  updateWake();
  try {
    run.stream = await openMic();
  } catch (e) {
    if (L.run === run) failRec(micTrouble(e));
    return;
  }
  if (L.run !== run) { run.stream.getTracks().forEach((t) => t.stop()); return; }
  try {
    run.ac = contextFor(run.stream);
    await run.ac.resume();
    const cap = await capture(run.ac, run.stream, (block) => heardBlock(run, block));
    if (L.run !== run) { cap.stop(); closeAc(run); return; }
    run.cap = cap;
  } catch {
    if (L.run === run) failRec(SAY.cantRecord);
    else { run.stream.getTracks().forEach((t) => t.stop()); closeAc(run); }
    return;
  }
  run.heardAt = performance.now();
  run.stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => { if (L.run === run) failRec(SAY.micStopped); }));
  // the sound clock may stop (another app takes the sound): never leave a stuck Stop
  run.check = setInterval(() => {
    if (L.run === run && performance.now() - run.heardAt > 3000) failRec(SAY.micBroken);
  }, 500);
  live();
}

function heardBlock(run, block) {
  if (L.run !== run) return;
  run.heardAt = performance.now();
  const s = block.samples;
  const before = run.frames;
  run.frames += s.length;
  for (let i = 0; i < s.length; i += 1) {
    const a = Math.abs(s[i]);
    if (a > run.peak) run.peak = a;
    if (a >= FULL) run.loudAt = before + i;
  }
  if (run.frames >= LAB.most * run.ac.sampleRate) { finishRec(false); return; }
  if (Math.floor(run.frames / (run.ac.sampleRate / 10)) !== Math.floor(before / (run.ac.sampleRate / 10))) live();
}

/** Stop and listen to it (`byKid`: Stop was pressed; else the limit was reached). */
function finishRec(byKid = false) {
  const run = L.run;
  if (!run) return;
  if (!run.cap) { stopRec(''); L.stage = 'ready'; paint(); updateWake(); return; } // the microphone wasn't open yet
  const rate = run.ac.sampleRate;
  const blocks = run.cap.blocks;
  // the kid's Stop: from the finger landing on it (or the tap, without one), less the knock
  const down = run.down && performance.now() - run.down.t < DOWN_FRESH ? run.down.frames : run.frames;
  const end = byKid ? Math.max(0, down - Math.round(STOP_CUT * rate)) : Infinity;
  stopRec('');
  let samples;
  try {
    samples = joinBlocks(blocks).samples;
    const most = Math.min(end, Math.round(LAB.most * rate));
    if (samples.length > most) samples = samples.slice(0, most);
  } catch {
    L.stage = 'ready'; say(SAY.broken, 'bad'); paint(); updateWake(); return;
  }
  L.kept = samples.length / rate;
  if (samples.length < SHORTEST * rate || peakOf(samples) < SILENT) { nothingHeard(); return; }
  L.sound = { samples: normalise(samples).samples, rate };
  listenTo(L.sound);
}

/** The recording stopped by itself (the app put away, the microphone gone, a failure). */
function failRec(text) {
  stopRec(text, 'bad');
  L.stage = 'ready';
  forget();
  paint();
  updateWake();
}

/** End a recording, keeping nothing: let the microphone and the sound clock go. */
function stopRec(text, kind = '') {
  const run = L.run;
  L.token += 1;
  L.run = null;
  if (run) {
    clearInterval(run.check);
    if (run.cap) run.cap.stop();
    else run.stream?.getTracks().forEach((t) => t.stop());
    closeAc(run);
  }
  if (text) say(text, kind);
}

function closeAc(run) {
  run.ac?.close?.().catch(() => {});
  run.ac = null;
}

// ---------- listening ----------

function listenTo(sound) {
  L.stage = 'listen';
  L.progress = 0;
  paint();
  updateWake();
  L.job = hearNotes(sound.samples, sound.rate, [], {
    progress: (f) => { L.progress = f; showProgress(); },
    done: (notes, failed) => {
      L.job = null;
      if (L.sound !== sound) return;
      if (failed) { forget(); L.stage = 'ready'; say(SAY.broken, 'bad'); paint(); updateWake(); return; }
      heardIn(notes);
    },
  });
}

function heardIn(notes) {
  const kept = notes.filter((n) => Number.isFinite(n?.midi) && Number.isFinite(n?.on));
  const res = kept.length >= LEAST_NOTES ? tuneReadings(kept) : null;
  if (!res?.tidy?.length || !res.tidy[0]?.notes?.length) { nothingHeard(); return; }
  L.heard = kept;
  L.result = res;
  L.bpm = res.bpm;
  L.pick = 'tidy';
  L.how = Object.fromEntries(READINGS.map((r) => [r.id, { voice: startVoice(r.id), shift: 0 }]));
  L.stage = 'pick';
  L.robot = '';
  paint();
  updateWake();
}

function nothingHeard() {
  forget();
  L.stage = 'ready';
  L.robot = ROBOT.nothing;
  paint();
  updateWake();
}

function stopListening() {
  L.job?.stop();
  L.job = null;
}

function showProgress() {
  const bar = body()?.querySelector('.lab-progress');
  if (!bar) return;
  const p = Math.round(L.progress * 100);
  bar.setAttribute('aria-valuenow', String(p));
  bar.querySelector('i').style.width = `${p}%`;
}

// ---------- listening to the readings and the shelf ----------

function audio() {
  if (A.ac && A.ac.state !== 'closed') return A.ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { A.ac = new AC(); } catch { A.ac = null; }
  return A.ac;
}

/** What a sound plays: { parts, bpm, voice, shift } for a reading or a kept tune. */
function tuneOf(key) {
  if (key.startsWith('slot|')) {
    const t = L.shelf?.[Number(key.slice(5))];
    return t && { parts: t.parts, bpm: t.bpm, voice: t.voice, shift: t.shift || 0, id: t.id };
  }
  const parts = L.result?.[key];
  const how = L.how[key];
  return parts && how && { parts, bpm: L.bpm || L.result.bpm, voice: how.voice, shift: how.shift, id: `${key}|${L.result.meter}` };
}

/** The sound's buffers: the tune in its voice and shift, a band under it as in the studio. */
function buffersOf(t, rate) {
  const made = `${t.id}|${t.voice}|${t.shift}|${t.bpm}|${rate}`;
  if (!L.made.has(made)) {
    L.made.set(made, Promise.all(t.parts.map((p) => renderEvents(p.notes, {
      bpm: t.bpm,
      steps: Math.max(1, p.beats) * 2,
      voice: p.role === 'band' ? READING_VOICES.band.band : t.voice,
      shift: p.role === 'band' ? 0 : t.shift,
      sampleRate: rate,
      peak: 0.5 * roleLevel(p.role),
    }))).catch(() => null));
  }
  return { made, job: L.made.get(made) };
}

/** Play a sound (a Listen button), or stop it when it is the one playing. One at a time. */
async function hear(key) {
  if (L.hearing === key) { stopSound(); return; }
  if (state.settings?.sound === false) { toast(SAY.soundOff); return; }
  const ac = audio();
  if (!ac) { say(SAY.noSound, 'bad'); paint(); return; }
  stopSound(false);
  if (L.result?.[key]) L.pick = key;
  L.hearing = key;
  let bufs;
  if (key === 'raw') {
    if (!L.sound) { L.hearing = ''; return; }
    try {
      const b = ac.createBuffer(1, L.sound.samples.length, L.sound.rate);
      b.copyToChannel(L.sound.samples, 0);
      bufs = [b];
    } catch { bufs = null; }
    paint();
    try { await ac.resume(); } catch { /* the next tap */ }
  } else {
    const t = tuneOf(key);
    if (!t) { L.hearing = ''; paint(); return; }
    const { made, job } = buffersOf(t, ac.sampleRate);
    L.waiting = job.ready ? '' : key;
    paint();
    try { await ac.resume(); } catch { /* the next tap */ }
    bufs = await job;
    if (bufs) job.ready = true;
    else L.made.delete(made);
    if (L.hearing !== key) return;
    const waited = L.waiting === key;
    L.waiting = '';
    if (waited && bufs) paint();
  }
  if (L.hearing !== key) return;
  if (!bufs) { L.hearing = ''; say(SAY.cantPlay, 'bad'); paint(); return; }
  const when = ac.currentTime + 0.05;
  let len = 0;
  for (const b of bufs) {
    const src = ac.createBufferSource();
    src.buffer = b;
    src.connect(ac.destination);
    src.start(when);
    A.sources.push(src);
    len = Math.max(len, b.duration);
  }
  A.playing = { key, at: when, len, sig: key === 'raw' ? 'raw' : (() => { const t = tuneOf(key); return `${t.voice}|${t.shift}`; })() };
  clearTimeout(A.timer);
  A.timer = setTimeout(() => { if (L.hearing === key) stopSound(); }, len * 1000 + 150);
}

function stopSound(draw = true) {
  clearTimeout(A.timer);
  for (const s of A.sources) { try { s.stop(); } catch { /* done */ } try { s.disconnect(); } catch { /* gone */ } }
  A.sources = [];
  A.playing = null;
  const was = L.hearing;
  L.hearing = '';
  L.waiting = '';
  if (was && draw) paint();
}

// ---------- the screen stays on while recording and listening ----------

function updateWake() {
  if (L.stage === 'rec' || L.stage === 'listen') keepAwake();
  else letSleep();
}

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
  if (document.visibilityState !== 'hidden') {
    // the browser let the wake lock go while the app was away: ask again if still listening
    if (L.on) { letSleep(); updateWake(); }
    return;
  }
  if (L.run) failRec(SAY.hidden);
  if (L.hearing) stopSound();
});

// ---------- opening it, and for tests ----------

export const labActions = {
  'lab-back': () => {
    if (L.keeping) return; // (a moment: the tune is on its way to the tablet)
    const back = deskOf(deskId())?.back || { view: 'kid' };
    leave();
    Object.assign(ui, back, { labTest: false });
    render();
  },
  // Settings › Try the Note-o-Matic: only from the parent's screen, which is behind the PIN
  'lab-test': () => { if (ui.view === 'parent') openLab({ test: true }); },
};

export function openLab({ test = false } = {}) {
  ui.labTest = test;
  ui.view = 'lab';
  render();
  window.scrollTo(0, 0);
}

/**
 * What the screen shows (for tests): { stage, robot, shelf (names and abouts, or null),
 * pick, meter, how, hearing, playing: { key, sig } (what is sounding), progress, worker,
 * recording, seconds (recorded so far), kept (seconds of the last recording kept) }.
 */
export function labState() {
  return {
    stage: L.stage,
    robot: robotLine(),
    shelf: L.shelf && L.shelf.map((t, i) => (t ? `${tuneName(i)}: ${tuneAbout(t)}` : null)),
    pick: L.pick,
    meter: L.result?.meter || 0,
    speed: L.bpm,
    found: L.result?.bpm || 0,
    readings: L.result ? READINGS.filter((r) => L.result[r.id]).map((r) => r.id) : [],
    how: JSON.parse(JSON.stringify(L.how)),
    hearing: L.hearing,
    playing: A.playing ? { key: A.playing.key, sig: A.playing.sig } : null,
    progress: L.progress,
    worker: Boolean(L.job?.worker),
    recording: Boolean(L.run),
    seconds: L.run?.ac ? L.run.frames / L.run.ac.sampleRate : 0,
    kept: L.kept,
  };
}
