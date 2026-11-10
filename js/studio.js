// The music house's recording studio: a mixing desk where a kid builds a short loop (30
// seconds at most) on four tracks, from ready-made parts of the game's songs (the tune, the
// sparkle, the bass and the drums) and from their own piano, recorded with the tablet's
// microphone. Clips can be moved, copied, trimmed and thrown away, by tapping or dragging.
// The mix on the desk is kept as a draft, and a kid can keep a few mixes (studio-store.js,
// on this tablet only). The rules live in studiorules.js, the sound arithmetic in
// studio-audio.js. It opens once today's chores are done.
//
// app.js redraws the whole page whenever a view's HTML changes, so viewStudio() returns a
// small shell that only depends on the kid, and mountStudio() draws everything inside it
// from the state kept here. A redraw never stops the music, a recording or a drag.
// Shared things come from ctx.js; app.js adds studioActions to its actions.

import { ui, state, esc, kidById, render, progressFor, toast, viewKid, today, confirmModal } from './ctx.js';
import { studioOpen, musicTier } from './musicrules.js';
import { songbookFor, keyLabel } from './sheetmusic.js';
import { treasureFound } from './treasure.js';
import { songParts, renderPart } from './music.js';
import {
  TRACKS, MIX_SLOTS, PART_NAMES, BPM_RANGE, newMix, sourceOf, maxBars, mixBeats, mixSeconds, addPart, addTake, moveClip,
  trimClip, copyClip, removeClip, setBars, setBpm, isFree, roomAt, bestSpot, findClip, keyFits, schedule, badges,
} from './studiorules.js';
import { loadMixes, saveMix, deleteMix, saveTake, loadTake, sweepTakes } from './studio-store.js';
import {
  CLICK, normalise, findOnsets, joinBlocks, guessDelay, sliceSchedule, pct, beatAt, waveLine, echoDelay, countInDelay,
  clickWave, clickPlan, makeTake, fadeEnds, phonesDelay, softClip,
} from './studio-audio.js';

// ---------- words ----------

const SAY = {
  soundOff: 'The sound is off. A parent can turn it on in Settings.',
  noSound: 'This tablet can\'t play sound here. Try closing the app and opening it again.',
  micRefused: 'I\'m not allowed to use the microphone. A parent can allow the microphone for this app in Chrome\'s site settings.',
  noMic: 'I can\'t find a microphone on this tablet.',
  micBroken: 'The microphone isn\'t working right now. Try again in a moment.',
  cantRecord: 'This tablet can\'t record in the studio. Ask a parent to update Chrome.',
  spotTaken: 'Something is already on that spot. Tap an empty place on a track, then press Record.',
  nothingHeard: 'I didn\'t hear anything, so I kept nothing. Play a little louder, or move the tablet closer to the piano.',
  stoppedEarly: 'You stopped before the recording began, so nothing was kept.',
  takeMissing: 'One of your recordings is missing from this tablet, so that clip stays quiet.',
  partBroken: 'A part couldn\'t get ready, so it stays quiet. Try again in a moment.',
  keepFailed: 'I couldn\'t keep that recording. Please try again.',
  checkOk: 'All set! Your recordings will line up.',
  checkFail: 'I couldn\'t hear the clicks. Turn the volume up, unplug headphones and try again.',
  emptyPlay: 'Add a part or record yourself first, then press Play.',
  emptySave: 'Add some music to your mix first, then save it.',
  full: 'All four tracks are full. Delete a clip or make one shorter first.',
  saveFailed: 'I couldn\'t save that. This tablet may be full.',
  deleteFailed: 'I couldn\'t delete that. Please try again.',
  waitRec: 'Wait for the recording to finish first.',
  waitCheck: 'Wait for the timing check to finish.',
  waitSave: 'Wait a moment. I\'m keeping your recording.',
  nothingToUndo: 'There is nothing to undo.',
};

/** "1 beat", "16 beats". */
const beatsWord = (n) => `${n} beat${n === 1 ? '' : 's'}`;

const PART_ICONS = { lead: '🎵', arp: '✨', bass: '🎸', drums: '🥁' };
const STICKER_ICONS = { take: '🎤', duet: '🤝', band: '🎺', remix: '🔀', match: '🎯', solo: '🦸' };
const DELAY_KEY = 'kidquest.studio.delay';
const OUT_KEY = 'kidquest.studio.delay.out'; // how late the speaker was when the delay was measured
const PHONES_KEY = 'kidquest.studio.phones';
const BPM_STEP = 5;
const MOST_PARTS = 10;  // rendered parts kept ready (each is a whole song of sound)
const MOST_WAVES = 200; // little pictures of takes kept ready
const MOST_UNDO = 20;   // mixes Undo can step back through
const LEAD = 0.06;      // seconds kept from before a take's beat, so an early note keeps its start
const TOUCH_LAG = 0.08; // how long a finger takes to press Stop after the kid means to

/** A number kept on this tablet (localStorage), or null. */
function readNumber(key) {
  try {
    const v = globalThis.localStorage?.getItem(key);
    return v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  } catch { return null; }
}
/** Keep a value on this tablet (private mode: just for this visit). */
function keep(key, value) {
  try { globalThis.localStorage?.setItem(key, String(value)); } catch { /* lasts while the app is open */ }
}

// ---------- what the studio remembers while the app is open ----------

const S = {
  on: false,          // the studio is on screen
  kid: null,          // whose desk this is
  loading: false,
  mix: newMix(),
  slots: [],          // the kid's saved mixes (or null)
  clean: '',          // the mix as it was last opened or saved in a slot, to know if it changed
  spot: { track: 0, beat: 0, picked: false }, // where new parts and recordings go
  sel: null,          // the selected clip's id
  panel: '',          // '', 'mixes' or 'help'
  note: '',           // a kind message on the desk
  noteKind: '',
  badges: [],
  pop: '',            // a sticker just earned
  busy: '',           // 'play', 'mic' or 'check' while getting ready, 'save' while a take is kept
  undo: [],           // the mixes before the last changes of this visit, the newest last
  hearing: '',        // the part being heard on the shelf ('song|part')
  phones: readNumber(PHONES_KEY) === 1,
  takes: new Map(),   // take id -> { rate, samples, lead }, or null when it is gone
  waves: new Map(),   // a take's little picture, by take and stretch
};

// the sound: one AudioContext for playing and recording
const A = {
  ac: null, master: null, worklet: null,
  parts: new Map(),    // 'song|part|bpm' -> Promise<AudioBuffer|null>, the last used at the end
  buffers: new Map(),  // 'take|id' -> AudioBuffer
  clicks: new Map(),   // the metronome's click for each note -> AudioBuffer
  sources: new Set(),  // everything started, so Stop stops it at once
  timer: 0, raf: 0, hearTimer: 0,
  token: 0,            // bumped by every stop, so a start that is still getting ready gives up
  play: null,          // { mix, bufs, plan, loop, beat, origin, k, first }
  rec: null,           // a recording or timing check under way
  finishing: null,     // a recording that stopped and is being kept
  bus: null,           // the volume knob for this run of play, faded down when it stops
  down: null,          // when a finger landed on Record or Stop: { at (audio clock), t }
};

// the screen stays on while recording, checking the timing or playing
const W = { lock: null, asking: false, refused: false };

let drag = null;       // a clip being dragged: { pointer, x0, y0, width, track, id, mode, moved, ghost }
let saveTimer = 0;
let pending = null;    // the draft waiting to be saved: { kid, mix }

const hasClips = (mix) => mix.tracks.some((t) => t.length);
const fingerprint = (mix) => JSON.stringify([mix.bpm, mix.bars, mix.meter, mix.tracks]);
const dirty = () => hasClips(S.mix) && fingerprint(S.mix) !== S.clean;
const onScreen = () => S.on && ui.view === 'studio' && document.visibilityState !== 'hidden';
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

// ---------- the screen ----------

/** The studio screen: a small shell; mountStudio fills it. Locked until today's chores are done. */
export function viewStudio() {
  const kid = kidById(ui.kidId);
  if (!kid || !studioOpen(state, kid, today()).open) { ui.view = 'kid'; return viewKid(); }
  return `
    <div class="screen studio-screen" style="--kid:${esc(kid.color)}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="studio-back" aria-label="Back to the music house">←</button>
        <div class="kid-title"><b>🎚️ Recording studio</b><small>${esc(kid.name)}'s mixing desk</small></div>
      </header>
      <div id="studio" class="studio" data-kid="${esc(kid.id)}"><p class="muted">Getting your studio ready…</p></div>
    </div>`;
}

/**
 * After each redraw of the page: start the studio in a new shell (drawn from what is kept
 * here, the sound carries on), or stop everything when the studio isn't on screen.
 */
export function mountStudio(root) {
  const el = root.querySelector('#studio');
  if (!el) { if (S.on) leave(); return; }
  if (el.dataset.live) return;
  el.dataset.live = '1';
  S.on = true;
  drag = null;
  el.addEventListener('pointerdown', onDown);
  if (S.kid !== el.dataset.kid) openDesk(el.dataset.kid);
  else paint();
}

/**
 * The studio closed (another screen): stop the sound and the microphone. A take under way is
 * kept, and one being kept finishes by itself. Then thrown-away takes are swept up.
 */
function leave() {
  S.on = false;
  stopAll();
  const kid = S.kid;
  S.undo = []; // Undo is for one visit
  const keep = takeIds(S.mix);
  flushSave().then(() => (kid ? sweepTakes(kid, { keep }) : 0)).catch(() => {});
  // the parts and takes are big; they are made again quickly when the studio opens
  A.parts.clear();
  A.buffers.clear();
  A.ac?.suspend?.().catch(() => {});
  updateWake();
}

/**
 * Stop playing, recording, a timing check and a part being heard. A take that is past its
 * count-in is kept (at once, without waiting for the microphone's last sound); one in its
 * count-in is cancelled. A take already being kept is never stopped.
 */
function stopAll() {
  if (A.finishing) A.finishing.hurry = true;
  const r = A.rec;
  if (r?.kind === 'take' && A.ac.currentTime - outLag() > r.at + 0.05) finishRecording({ hurry: true });
  else if (r) cancelRecording();
  if (S.busy !== 'save') S.busy = '';
  stopPlay();
  updateWake();
}

/** Keep the screen on while something is under way in the studio, and let it go after. */
function updateWake() {
  const want = S.on && document.visibilityState !== 'hidden' && Boolean(A.play || A.rec || A.finishing || S.busy === 'check' || S.busy === 'save');
  if (want && !W.lock && !W.asking && !W.refused && navigator.wakeLock?.request) {
    W.asking = true;
    navigator.wakeLock.request('screen').then((lock) => {
      W.asking = false;
      W.lock = lock;
      lock.addEventListener?.('release', () => { if (W.lock === lock) W.lock = null; });
      updateWake(); // it may not be needed any more
    }).catch(() => { W.asking = false; W.refused = true; });
  } else if (!want && W.lock) {
    const lock = W.lock;
    W.lock = null;
    lock.release?.().catch(() => {});
  }
}

/** Throw away this kid's takes that no mix uses (the desk's and Undo's are kept too). */
function sweep(kid = S.kid) {
  if (kid) sweepTakes(kid, { keep: [S.mix, ...S.undo].flatMap(takeIds) }).catch(() => {});
}

/** A new kid at the desk: their draft and saved mixes. */
async function openDesk(kid) {
  stopAll();
  flushSave();
  Object.assign(S, { kid, loading: true, mix: newMix(), slots: [], clean: '', sel: null, panel: '', note: '', badges: [], pop: '', undo: [], spot: { track: 0, beat: 0, picked: false } });
  S.takes.clear();
  S.waves.clear();
  paint();
  let got = { draft: null, slots: [] };
  try { got = await loadMixes(kid); } catch { /* nothing kept yet */ }
  if (S.kid !== kid) return;
  S.loading = false;
  S.mix = got.draft || newMix();
  S.slots = Array.from({ length: MIX_SLOTS }, (_, i) => got.slots[i] || null);
  const same = S.slots.find((m) => m && fingerprint(m) === fingerprint(S.mix));
  S.clean = same ? fingerprint(same) : '';
  try {
    S.badges = badges(S.mix);
    paint();
  } catch {
    // a draft that can't be drawn: an empty desk instead (the saved mixes stay as they are)
    Object.assign(S, { mix: newMix(), clean: '', badges: [], sel: null });
    try { paint(); } catch { S.slots = S.slots.map(() => null); paint(); }
  }
  loadTakes(S.mix);
  sweep(kid);
}

/** Fetch the takes a mix uses (for their pictures, and to play them), then draw again. */
async function loadTakes(mix) {
  const ids = [...new Set(takeIds(mix))].filter((id) => !S.takes.has(id));
  if (!ids.length) return;
  for (const id of ids) {
    let t = null;
    try { t = await loadTake(id); } catch { t = null; }
    S.takes.set(id, t);
  }
  paint();
}

/** The takes a mix uses, by id. */
const takeIds = (mix) => mix.tracks.flat().filter((c) => c.kind === 'take').map((c) => c.take);

/** Forget the sound of takes that neither the desk's mix, a saved mix nor Undo uses. */
function forgetTakes() {
  const used = new Set([S.mix, ...S.slots, ...S.undo].filter(Boolean).flatMap(takeIds));
  for (const id of [...S.takes.keys()]) {
    if (used.has(id)) continue;
    S.takes.delete(id);
    A.buffers.delete(`take|${id}`);
    for (const k of [...S.waves.keys()]) if (k.startsWith(`${id}|`)) S.waves.delete(k);
  }
}

/** The songs whose parts this kid may use: the ones open in their songbook. */
function shelfSongs() {
  const kid = kidById(S.kid);
  if (!kid) return [];
  const book = songbookFor(musicTier(progressFor(kid)), treasureFound(state.log, kid.id).maps);
  return book.filter((p) => p.open && sourceOf(p.id));
}

/**
 * Where the next part or recording goes: { track, beat, room, picked }. The spot the kid
 * picked, or else the free place with the most room. Null when every track is full.
 */
function currentSpot() {
  const mix = S.mix;
  if (S.spot.picked && S.spot.beat < mixBeats(mix) && S.spot.track < TRACKS) return { ...S.spot, room: roomAt(mix, S.spot.track, S.spot.beat) };
  const best = bestSpot(mix);
  return best && { ...best, picked: false };
}

/** Where new music goes, in kid words. */
function spotHint() {
  const spot = currentSpot();
  if (!spot) return SAY.full;
  if (spot.room < 1) return 'Something is already on that spot. Tap an empty place on a track.';
  return `New music goes on track ${spot.track + 1}, beat ${spot.beat + 1}. There is room for ${beatsWord(spot.room)}.`;
}

/** Draw the whole desk again from what is kept here (not while a clip is being dragged). */
function paint() {
  const el = document.querySelector('#studio[data-live]');
  if (!el) return;
  if (drag) { drag.repaint = true; return; }
  if (S.loading) { el.innerHTML = '<p class="muted st-wait">Getting your studio ready…</p>'; return; }
  el.innerHTML = `${transportHtml()}${S.note ? noteHtml() : ''}${S.panel === 'mixes' ? mixesHtml() : ''}${S.panel === 'help' ? helpHtml() : ''}
    ${timelineHtml()}${toolsHtml()}${stickersHtml()}${shelfHtml()}`;
  S.pop = '';
  placeEdges();
  if (A.play || A.rec) follow();
  updateWake();
}

/**
 * A narrow picked clip gets its edge handles outside it (where the track has room), so a
 * finger can still grab its middle to move it.
 */
function placeEdges() {
  const clip = document.querySelector('#studio .st-clip.sel');
  if (!clip) return;
  const lane = clip.parentElement.getBoundingClientRect();
  const r = clip.getBoundingClientRect();
  const narrow = r.width < 120;
  clip.classList.toggle('out-left', narrow && r.left - lane.left >= 42);
  clip.classList.toggle('out-right', narrow && lane.right - r.right >= 42);
}
globalThis.addEventListener?.('resize', placeEdges);

function transportHtml() {
  const mix = S.mix;
  const rec = A.rec && A.rec.kind === 'take';
  const playing = Boolean(A.play) || S.busy === 'play';
  const held = S.busy === 'mic' || S.busy === 'check' || S.busy === 'save';
  const takes = mix.tracks.flat().some((c) => c.kind === 'take');
  const speedWhy = takes ? setBpm(mix, mix.bpm + 1).error : '';
  const secs = Math.round(mixSeconds(mix));
  const recLabel = S.busy === 'mic' ? 'Getting ready…' : S.busy === 'save' ? 'Saving…' : rec ? '■ Stop recording' : '● Record';
  return `
    <div class="st-bar">
      <div class="st-main">
        <button class="btn st-play ${playing ? 'playing' : ''}" data-action="st-play" ${rec || held ? 'disabled' : ''}>${playing ? '■ Stop' : '▶ Play'}</button>
        <button class="btn st-rec ${rec ? 'recording' : ''}" data-action="st-rec" ${held ? 'disabled' : ''}><span class="st-rec-label">${recLabel}</span></button>
        <button class="btn ghost st-undo ${S.undo.length ? '' : 'off'}" data-action="st-undo" ${S.undo.length ? '' : 'aria-disabled="true"'}>↩ Undo</button>
      </div>
      <div class="st-step" role="group" aria-label="Loop length">
        <button class="btn ghost round ${mix.bars <= 2 ? 'off' : ''}" data-action="st-bars" data-d="-1" aria-label="Fewer bars">−</button>
        <span class="st-val"><b>${mix.bars} bars</b><small>${secs} seconds</small></span>
        <button class="btn ghost round ${mix.bars >= maxBars(mix.bpm, mix.meter) ? 'off' : ''}" data-action="st-bars" data-d="1" aria-label="More bars">+</button>
      </div>
      <div class="st-step ${takes ? 'locked' : ''}" role="group" aria-label="Speed" ${takes ? `title="${esc(speedWhy)}"` : ''}>
        <button class="btn ghost round ${takes || mix.bpm <= BPM_RANGE[0] ? 'off' : ''}" data-action="st-bpm" data-d="-1" aria-label="Slower" ${takes ? 'aria-disabled="true"' : ''}>🐢</button>
        <span class="st-val"><b>Speed ${mix.bpm}</b><small>${takes ? 'kept for your take' : 'beats a minute'}</small></span>
        <button class="btn ghost round ${takes || mix.bpm >= BPM_RANGE[1] ? 'off' : ''}" data-action="st-bpm" data-d="1" aria-label="Faster" ${takes ? 'aria-disabled="true"' : ''}>🐇</button>
      </div>
      <div class="st-more">
        <button class="btn ghost st-phones ${S.phones ? 'on' : ''}" data-action="st-phones" aria-pressed="${S.phones}">🎧 Headphones ${S.phones ? 'on' : 'off'}</button>
        <button class="btn ghost ${S.panel === 'mixes' ? 'on' : ''}" data-action="st-panel" data-panel="mixes" aria-pressed="${S.panel === 'mixes'}">💾 My mixes</button>
        <button class="btn ghost ${S.panel === 'help' ? 'on' : ''}" data-action="st-panel" data-panel="help" aria-pressed="${S.panel === 'help'}" aria-label="Help">❓</button>
      </div>
    </div>`;
}

function noteHtml() {
  return `<p class="st-note ${S.noteKind}" role="status"><span>${esc(S.note)}</span><button class="btn ghost small-btn" data-action="st-note-close">OK</button></p>`;
}

/** A part clip's words: its icon and name, its song, its key. */
function partWords(c) {
  const src = sourceOf(c.song);
  return { icon: PART_ICONS[c.part] || '🎵', name: PART_NAMES[c.part] || 'Part', song: src?.name || '', key: src?.key ? keyLabel(src.key) : '' };
}

function timelineHtml() {
  const mix = S.mix;
  const beats = mixBeats(mix);
  const spot = currentSpot();
  const ruler = Array.from({ length: mix.bars }, (_, i) => `<span style="left:${pct(i * mix.meter, beats)}%">${i + 1}</span>`).join('');
  const lanes = mix.tracks.map((clips, t) => {
    const body = clips.map((c) => clipHtml(c, beats)).join('');
    const mark = spot && spot.track === t && !A.rec ? `<span class="st-spot ${spot.picked ? '' : 'auto'}" style="left:${pct(spot.beat, beats)}%;width:${pct(1, beats)}%" aria-hidden="true"></span>` : '';
    const recBox = A.rec?.kind === 'take' && A.rec.track === t ? `<span class="st-recbox" style="left:${pct(A.rec.beat, beats)}%;width:0"></span>` : '';
    return `<div class="st-lane" data-track="${t}" aria-label="Track ${t + 1}">${body}${mark}${recBox}</div>`;
  }).join('');
  const label = hasClips(mix)
    ? `${esc(mix.name)}${mix.key ? ` · ${esc(keyLabel(mix.key))}` : ''} · ${mix.meter} beats in a bar`
    : 'Your mix is empty. Tap a part below to start!';
  return `
    <section class="st-desk" aria-label="Your mix">
      <p class="st-mixname">${label}</p>
      <div class="st-time">
        <div class="st-names" aria-hidden="true"><span></span>${mix.tracks.map((_, t) => `<span>${t + 1}</span>`).join('')}</div>
        <div class="st-lanes" style="--beats:${beats};--bars:${mix.bars}">
          <div class="st-ruler">${ruler}</div>
          ${lanes}
          <div class="st-head" hidden></div>
        </div>
      </div>
    </section>`;
}

function clipHtml(c, beats) {
  const sel = c.id === S.sel;
  const style = `left:${pct(c.start, beats)}%;width:${pct(c.len, beats)}%`;
  const edges = sel ? '<span class="st-edge left" data-edge="left" aria-hidden="true"></span><span class="st-edge right" data-edge="right" aria-hidden="true"></span>' : '';
  if (c.kind === 'take') {
    const t = S.takes.get(c.take);
    const gone = S.takes.has(c.take) && !t;
    return `<div class="st-clip kind-take ${sel ? 'sel' : ''} ${gone ? 'gone' : ''}" data-id="${c.id}" style="${style}" title="My take">
      ${t ? waveSvg(c, t) : ''}<b>🎤 My take</b>${gone ? '<small>Missing</small>' : ''}${edges}</div>`;
  }
  const w = partWords(c);
  return `<div class="st-clip kind-${esc(c.part)} ${sel ? 'sel' : ''}" data-id="${c.id}" style="${style}" title="${esc(`${w.name}, ${w.song}, ${w.key}`)}">
    <b>${w.icon} ${esc(w.name)}</b><small>${esc(w.song)}</small><small class="st-key">${esc(w.key)}</small>${edges}</div>`;
}

/** A take's little picture: its loudness along the stretch the clip plays. */
function waveSvg(c, t) {
  const beat = 60 / S.mix.bpm;
  const key = `${c.take}|${c.from}|${c.len}|${S.mix.bpm}`;
  if (!S.waves.has(key)) {
    if (S.waves.size >= MOST_WAVES) S.waves.clear(); // they are drawn again quickly
    // the sound from before the beat isn't drawn: the picture starts on the clip's beat
    const line = waveLine(t.samples, t.rate, (t.lead || 0) + c.from * beat, c.len * beat, 40);
    const d = line.map((v, i) => `M${i + 0.5} ${(10 - v * 9).toFixed(1)}V${(10 + v * 9).toFixed(1)}`).join('');
    S.waves.set(key, `<svg class="st-wave" viewBox="0 0 40 20" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`);
  }
  return S.waves.get(key);
}

function toolsHtml() {
  const found = S.sel != null && findClip(S.mix, S.sel);
  if (!found) return `<p class="st-hint muted">${esc(spotHint())} Tap an empty place on a track to choose another spot. Tap a clip to change it.</p>`;
  const { clip: c } = found;
  const words = c.kind === 'take' ? '🎤 My take' : (() => { const w = partWords(c); return `${w.icon} ${w.name} from ${w.song}, in ${w.key}`; })();
  const b = (todo, label, aria) => `<button class="btn ghost small-btn" data-action="st-nudge" data-do="${todo}" aria-label="${aria}">${label}</button>`;
  return `
    <div class="st-tools" role="toolbar" aria-label="Change this clip">
      <p class="st-what"><b>${esc(words)}</b><small>Track ${found.track + 1}, beats ${c.start + 1} to ${c.start + c.len}</small></p>
      <div class="st-tool-buttons">
        ${b('earlier', '◀ Earlier', 'Start earlier')}${b('later', 'Later ▶', 'Start later')}
        ${b('up', '▲ Up', 'Up a track')}${b('down', '▼ Down', 'Down a track')}
        ${b('shorter', '✂ Shorter', 'One beat shorter')}${b('longer', '↔ Longer', 'One beat longer')}
        <button class="btn ghost small-btn" data-action="st-copy">⧉ Copy</button>
        <button class="btn ghost small-btn danger-text" data-action="st-delete">🗑 Delete</button>
        <button class="btn ghost small-btn" data-action="st-unselect" aria-label="Done">✓ Done</button>
      </div>
    </div>`;
}

function stickersHtml() {
  if (!S.badges.length) return '<section class="st-stickers empty"><p class="muted">Stickers you earn with this mix show up here. Try recording yourself, or mixing two songs!</p></section>';
  return `<section class="st-stickers" aria-label="Stickers">${S.badges.map((b) => `
    <div class="st-sticker ${S.pop === b.id ? 'pop' : ''}" data-sticker="${esc(b.id)}"><i aria-hidden="true">${STICKER_ICONS[b.id] || '⭐'}</i><b>${esc(b.name)}</b><small>${esc(b.why)}</small></div>`).join('')}</section>`;
}

function shelfHtml() {
  const mix = S.mix;
  const songs = shelfSongs();
  const cards = songs.map((p) => {
    const src = sourceOf(p.id);
    let parts = [];
    try { parts = songParts(p.id); } catch { parts = ['lead']; }
    const fits = mix.key && hasClips(mix) ? keyFits(mix.key, src.key) : null;
    const beatNote = src.meter === 3 ? '<small class="st-waltz">3 beats in a bar</small>' : '';
    const fit = fits === true ? '<small class="st-fit">✓ Goes with your mix</small>' : fits === false ? '<small class="st-fit no">Another key</small>' : '';
    const buttons = parts.map((part) => {
      const on = S.hearing === `${p.id}|${part}`;
      return `<span class="st-part"><button class="btn small-btn st-add kind-${part}" data-action="st-add" data-song="${esc(p.id)}" data-part="${part}">${PART_ICONS[part]} ${PART_NAMES[part]}</button><button class="btn ghost small-btn st-hear ${on ? 'on' : ''}" data-action="st-hear" data-song="${esc(p.id)}" data-part="${part}" aria-label="${on ? 'Stop' : `Hear the ${PART_NAMES[part]}`}">${on ? '■' : '🔊'}</button></span>`;
    }).join('');
    return `<div class="st-song" data-song="${esc(p.id)}">
      <p class="st-song-name"><span aria-hidden="true">${p.kind === 'show' ? '✨' : '🎵'}</span><b>${esc(p.name)}</b></p>
      <p class="st-song-info"><small>${esc(keyLabel(src.key))}</small>${beatNote}${fit}</p>
      <div class="st-parts">${buttons}</div></div>`;
  }).join('');
  return `
    <section class="st-shelf" aria-label="Parts from your songs">
      <h3>Parts from your songs</h3>
      <p class="muted small">Tap a part to put it in your mix. Tap 🔊 to hear it first.</p>
      <div class="st-songs">${cards || '<p class="muted">Your songbook\'s songs show up here.</p>'}</div>
    </section>`;
}

function mixesHtml() {
  const slot = (m, i) => {
    if (!m) return `<li><button class="st-slot empty" data-action="st-slot-save" data-slot="${i}">💾 Save this mix here</button></li>`;
    const stickers = badges(m).map((b) => `<span title="${esc(b.name)}">${STICKER_ICONS[b.id] || '⭐'}</span>`).join('');
    return `<li><div class="st-slot">
      <p><b>${esc(m.name)}</b><small>${m.bars} bars · ${Math.round(mixSeconds(m))} seconds</small>${stickers ? `<span class="st-slot-stickers">${stickers}</span>` : ''}</p>
      <div class="st-slot-buttons">
        <button class="btn small-btn" data-action="st-slot-open" data-slot="${i}">Open</button>
        <button class="btn ghost small-btn" data-action="st-slot-save" data-slot="${i}">Save over</button>
        <button class="btn ghost small-btn danger-text" data-action="st-slot-del" data-slot="${i}">Delete</button>
      </div></div></li>`;
  };
  return `
    <section class="st-panel st-mixes" aria-label="My mixes">
      <div class="st-panel-head"><h3>My mixes</h3><button class="btn ghost small-btn" data-action="st-new">✨ New mix</button></div>
      <p class="muted small">You can keep ${MIX_SLOTS} mixes. They stay on this tablet.</p>
      <ol class="st-slots">${S.slots.map(slot).join('')}</ol>
    </section>`;
}

function helpHtml() {
  const checked = readNumber(DELAY_KEY) != null;
  return `
    <section class="st-panel st-help" aria-label="Help">
      <h3>How the studio works</h3>
      <ul>
        <li>Tap a part below to put it on a track. The first part sets the speed and the key of your mix.</li>
        <li>Tap an empty place on a track to choose where the next part or recording goes.</li>
        <li>Tap a clip to move it, copy it, make it shorter or longer, or throw it away. You can also drag a clip, or drag its edges.</li>
        <li>To record your piano, choose a spot and press Record. Listen to the clicks count you in, then play! Press Stop when you're done.</li>
        <li>Wearing headphones? Turn on Headphones to hear your whole mix while you record. Without headphones you only hear soft clicks, so the tablet doesn't record its own music.</li>
      </ul>
      <h3>The timing</h3>
      <p>The tablet sets the timing by itself. When you record without headphones, it listens to the clicks that count you in.</p>
      <p>Recording with headphones and it sounds late? Unplug them, turn the speaker up and keep the room quiet. Then tap the button, and the tablet plays some clicks and listens to them.</p>
      <p><button class="btn small-btn" data-action="st-check" ${A.rec || A.finishing || S.busy ? 'disabled' : ''}>${S.busy === 'check' || A.rec?.kind === 'check' ? 'Listening…' : '⏱️ Check the timing'}</button>
      <small class="muted">${checked ? 'The timing is set on this tablet.' : 'The timing isn\'t set yet. It sets itself the first time you record without headphones.'}</small></p>
    </section>`;
}

/** Show a kind message on the desk (it stays until the next one, or OK). */
function say(text, kind = '') {
  S.note = text;
  S.noteKind = kind;
  paint();
}

// ---------- changing the mix ----------

/**
 * The desk gets a new mix: Undo remembers the one before, stickers, the draft saved, and the
 * music carries on from the same place. `said` is a toast to show (with a new sticker's).
 */
function commit(mix, { select, said = '', undo = true } = {}) {
  const had = new Set(S.badges.map((b) => b.id));
  if (undo) rememberUndo();
  S.mix = mix;
  if (select !== undefined) S.sel = select;
  if (S.sel != null && !findClip(mix, S.sel)) S.sel = null;
  if (S.spot.beat >= mixBeats(mix)) S.spot = { track: S.spot.track, beat: 0, picked: false };
  S.badges = badges(mix);
  const fresh = undo && S.badges.find((b) => !had.has(b.id));
  S.pop = fresh?.id || '';
  if (fresh) setTimeout(() => toast(`${said ? `${said} ` : ''}🏅 New sticker: ${fresh.name}! ${fresh.why}`), 50);
  else if (said) toast(said);
  autosave();
  forgetTakes();
  if (A.play || S.busy === 'play') restartPlay();
  paint();
}

/** Undo can go back to the desk's mix as it is now. */
function rememberUndo() {
  if (S.undo[S.undo.length - 1] === S.mix) return;
  S.undo.push(S.mix);
  if (S.undo.length > MOST_UNDO) S.undo.shift();
}

/** Step back to the mix before the last change. */
function undo() {
  const before = S.undo.pop();
  if (!before) { toast(SAY.nothingToUndo); return; }
  commit(before, { undo: false });
  loadTakes(before);
}

/** Keep the desk's mix as the draft, a moment after the last change. */
function autosave() {
  pending = { kid: S.kid, mix: S.mix };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 500);
}

/** Save the draft now, if it is waiting. */
function flushSave() {
  clearTimeout(saveTimer);
  const p = pending;
  pending = null;
  return p ? saveMix(p.kid, 'draft', p.mix).catch(() => {}) : Promise.resolve();
}

/** Whether the desk is busy (recording, keeping a take, the timing check), so edits wait. */
function busyNow() {
  const why = A.rec?.kind === 'check' || S.busy === 'check' ? SAY.waitCheck
    : S.busy === 'save' || A.finishing ? SAY.waitSave
      : A.rec || S.busy === 'mic' ? SAY.waitRec : '';
  if (why) toast(why);
  return Boolean(why);
}

/** Whether edits must wait, without saying so (for a finger on the timeline). */
const heldNow = () => Boolean(A.rec || A.finishing || S.busy === 'mic' || S.busy === 'check' || S.busy === 'save');

/** Whether the sound is turned off in the family's settings (and say so). */
function soundOff() {
  if (state.settings?.sound === false) { toast(SAY.soundOff); return true; }
  return false;
}

function nudge(todo) {
  const found = S.sel != null && findClip(S.mix, S.sel);
  if (!found) return;
  const { clip: c, track } = found;
  const id = c.id;
  let r;
  if (todo === 'earlier' || todo === 'later') {
    const at = c.start + (todo === 'earlier' ? -1 : 1);
    if (at < 0 || at + c.len > mixBeats(S.mix)) { toast(todo === 'earlier' ? 'It\'s already at the start.' : 'It\'s already at the end.'); return; }
    r = moveClip(S.mix, id, track, at);
  } else if (todo === 'up' || todo === 'down') {
    const t = track + (todo === 'up' ? -1 : 1);
    if (t < 0 || t >= TRACKS) { toast(todo === 'up' ? 'It\'s already on the top track.' : 'It\'s already on the bottom track.'); return; }
    r = moveClip(S.mix, id, t, c.start);
  } else {
    r = trimClip(S.mix, id, { len: c.len + (todo === 'shorter' ? -1 : 1) });
    const after = !r.error && findClip(r.mix, id)?.clip;
    if (after && after.len === c.len) { toast(todo === 'shorter' ? 'That\'s as short as it gets: one beat.' : 'It can\'t get any longer here.'); return; }
  }
  if (r.error) { toast(r.error); return; }
  commit(r.mix);
}

// ---------- dragging and tapping the timeline ----------

/** The track under a point on the screen, or null. */
function trackAt(y) {
  for (const lane of document.querySelectorAll('#studio .st-lane')) {
    const r = lane.getBoundingClientRect();
    if (y >= r.top && y < r.bottom) return Number(lane.dataset.track);
  }
  return null;
}

function onDown(e) {
  // Stop is timed from when the finger lands, not from the tap a moment later
  if (e.target.closest('[data-action="st-rec"]')) A.down = { at: A.ac?.currentTime, t: performance.now() };
  if (e.button > 0 || drag) return;
  const lane = e.target.closest('.st-lane');
  if (!lane) return;
  if (heldNow()) return;
  const clipEl = e.target.closest('.st-clip');
  const rect = lane.getBoundingClientRect();
  drag = {
    pointer: e.pointerId, x0: e.clientX, y0: e.clientY, left: rect.left, width: rect.width,
    track: Number(lane.dataset.track), id: clipEl ? Number(clipEl.dataset.id) : null,
    mode: e.target.closest('.st-edge')?.dataset.edge || 'move', moved: false, ghost: null, el: clipEl,
  };
  if (clipEl) {
    e.preventDefault();
    try { clipEl.setPointerCapture(e.pointerId); } catch { /* the document listeners follow it anyway */ }
  }
}

function onMove(e) {
  const d = drag;
  if (!d || e.pointerId !== d.pointer) return;
  const dx = e.clientX - d.x0;
  const dy = e.clientY - d.y0;
  if (!d.moved && Math.hypot(dx, dy) < 8) return;
  // a finger that sets off up or down scrolls the page; only sideways moves the clip
  if (!d.moved && e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) { onCancel(e); return; }
  d.moved = true;
  if (d.id == null) return; // a swipe over an empty place: the page scrolls
  const found = findClip(S.mix, d.id);
  if (!found) return;
  const c = found.clip;
  const beats = mixBeats(S.mix);
  const step = Math.round((dx / d.width) * beats);
  let ghost;
  if (d.mode === 'move') {
    const track = trackAt(e.clientY) ?? found.track;
    const start = Math.max(0, Math.min(beats - c.len, c.start + step));
    ghost = { track, start, len: c.len, ok: isFree(S.mix, track, start, c.len, c.id) };
  } else {
    const r = trimClip(S.mix, c.id, d.mode === 'left' ? { start: c.start + step } : { len: c.len + step });
    const t = findClip(r.mix, c.id).clip;
    ghost = { track: found.track, start: t.start, len: t.len, ok: !r.error };
  }
  d.ghost = ghost;
  showGhost(ghost, beats);
  d.el?.classList.add('dragging');
}

function showGhost(g, beats) {
  let el = document.querySelector('#studio .st-ghost');
  const lane = document.querySelector(`#studio .st-lane[data-track="${g.track}"]`);
  if (!lane) return;
  if (!el) { el = document.createElement('span'); el.setAttribute('aria-hidden', 'true'); }
  if (el.parentNode !== lane) lane.appendChild(el);
  el.className = `st-ghost ${g.ok ? 'ok' : 'bad'}`;
  el.style.left = `${pct(g.start, beats)}%`;
  el.style.width = `${pct(g.len, beats)}%`;
}

function onUp(e) {
  const d = drag;
  if (!d || e.pointerId !== d.pointer) return;
  drag = null;
  document.querySelector('#studio .st-ghost')?.remove();
  d.el?.classList.remove('dragging');
  if (!d.moved) {
    if (d.id != null) S.sel = S.sel === d.id ? null : d.id;
    else {
      S.spot = { track: d.track, beat: beatAt(e.clientX - d.left, d.width, mixBeats(S.mix)), picked: true };
      S.sel = null;
    }
    paint();
    return;
  }
  if (d.id == null || !d.ghost) { if (d.repaint) paint(); return; }
  const found = findClip(S.mix, d.id);
  const g = d.ghost;
  if (!found) { paint(); return; }
  let r;
  if (d.mode === 'move') {
    if (g.track === found.track && g.start === found.clip.start) { paint(); return; }
    r = moveClip(S.mix, d.id, g.track, g.start);
  } else {
    r = trimClip(S.mix, d.id, { start: g.start, len: g.len });
  }
  if (r.error) { toast(r.error); paint(); return; }
  commit(r.mix, { select: d.id });
}

function onCancel(e) {
  const d = drag;
  if (!d || e.pointerId !== d.pointer) return;
  drag = null;
  document.querySelector('#studio .st-ghost')?.remove();
  d.el?.classList.remove('dragging');
  if (d.repaint) paint();
}

globalThis.document?.addEventListener('pointermove', onMove);
globalThis.document?.addEventListener('pointerup', onUp);
globalThis.document?.addEventListener('pointercancel', onCancel);

// ---------- sound ----------

/** The studio's AudioContext, made on the first tap (null when this browser has none). */
function audio() {
  if (A.ac) {
    if (A.ac.state === 'suspended') A.ac.resume().catch(() => {});
    return A.ac;
  }
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    A.ac = new Ctx();
    A.clicks = new Map(); // clicks made for another AudioContext can't play in this one
    // four tracks at once stay safe: half volume, and the loudest bits bent over softly.
    // The bending adds no delay, so the music stays in time with the clicks.
    const net = A.ac.createWaveShaper();
    net.curve = softClip();
    net.oversample = 'none';
    A.master = A.ac.createGain();
    A.master.gain.value = 0.5;
    A.master.connect(net).connect(A.ac.destination);
  } catch {
    A.ac = null;
    return null;
  }
  return A.ac;
}

/** How late the speaker is: what plays at context time t is heard at t + this. */
const outLag = () => (A.ac ? A.ac.outputLatency || A.ac.baseLatency || 0 : 0);

/** One part of a song at a speed, rendered once and kept (null when it can't be made). */
function partBuffer(song, part, bpm) {
  const key = `${song}|${part}|${bpm}`;
  let made = A.parts.get(key);
  if (made) A.parts.delete(key);
  else made = renderPart(song, part, bpm, A.ac.sampleRate).catch(() => null);
  A.parts.set(key, made); // the last used goes to the end
  trimParts();
  return made;
}

/** Keep only a few rendered parts: forget the ones used longest ago, but never the mix's. */
function trimParts() {
  const mixes = [S.mix, A.play?.mix].filter(Boolean);
  const used = new Set(mixes.flatMap((m) => m.tracks.flat().filter((c) => c.kind === 'part').map((c) => `${c.song}|${c.part}|${m.bpm}`)));
  for (const k of [...A.parts.keys()]) {
    if (A.parts.size <= MOST_PARTS) break;
    if (!used.has(k)) A.parts.delete(k);
  }
}

/** A take as an AudioBuffer at its own rate (null when it is gone). */
async function takeBuffer(id) {
  const key = `take|${id}`;
  if (A.buffers.has(key)) return A.buffers.get(key);
  if (!S.takes.has(id)) {
    let t = null;
    try { t = await loadTake(id); } catch { t = null; }
    S.takes.set(id, t);
  }
  const t = S.takes.get(id);
  if (!t || !t.samples.length) return null;
  try {
    const b = A.ac.createBuffer(1, t.samples.length, t.rate);
    b.copyToChannel(t.samples, 0);
    A.buffers.set(key, b);
    return b;
  } catch { return null; }
}

/** Every clip's sound for a mix: Map clip id -> AudioBuffer. Missing ones are left out, kindly. */
async function buffersFor(mix) {
  const plan = schedule(mix);
  const got = await Promise.all(plan.map((e) => (e.kind === 'part' ? partBuffer(e.song, e.part, mix.bpm) : takeBuffer(e.take))));
  const out = new Map();
  let lost = 0;
  let broken = 0;
  plan.forEach((e, i) => {
    if (got[i]) out.set(e.id, got[i]);
    else if (e.kind === 'take') lost += 1;
    else broken += 1;
  });
  if (lost) say(SAY.takeMissing);
  else if (broken) say(SAY.partBroken);
  return out;
}

/** A fresh volume knob for one run of play (or one part heard): Stop fades it down. */
function newBus() {
  const g = A.ac.createGain();
  g.connect(A.master);
  A.bus = g;
  return g;
}

/**
 * Start a sound at `when` (context time), `offset` seconds in, for `dur`, with 5 ms fades.
 * `sharp`: the very start of a part, where a drum or a note begins, isn't faded in.
 */
function startSource(buffer, when, offset, dur, { sharp = false } = {}) {
  const ac = A.ac;
  if (![when, offset, dur].every(Number.isFinite)) return;
  let w = when;
  let off = offset;
  let len = Math.min(dur, buffer.duration - offset);
  if (w < ac.currentTime) { const late = ac.currentTime - w; w += late; off += late; len -= late; }
  if (len < 0.01) return;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const g = ac.createGain();
  const fade = Math.min(0.005, len / 4);
  g.gain.setValueAtTime(sharp && off === 0 ? 1 : 0, w);
  g.gain.linearRampToValueAtTime(1, w + fade);
  g.gain.setValueAtTime(1, w + len - fade);
  g.gain.linearRampToValueAtTime(0, w + len);
  src.connect(g).connect(A.bus || newBus());
  src.start(w, off, len);
  A.sources.add(src);
  src.onended = () => { A.sources.delete(src); try { g.disconnect(); } catch { /* gone */ } };
}

/** The metronome's click for a note, made once. */
function clickBuffer(hz) {
  if (!A.clicks.has(hz)) {
    const wave = clickWave(A.ac.sampleRate, hz);
    const b = A.ac.createBuffer(1, wave.length, A.ac.sampleRate);
    b.copyToChannel(wave, 0);
    A.clicks.set(hz, b);
  }
  return A.clicks.get(hz);
}

/**
 * A metronome click at a whole audio frame, straight to the speaker. Every click is the same
 * sound at the same loudness, so the count-in shows exactly what to take out of a take.
 */
function click(frame, hz) {
  const ac = A.ac;
  const src = ac.createBufferSource();
  src.buffer = clickBuffer(hz);
  const g = ac.createGain();
  g.gain.value = CLICK.vol;
  src.connect(g).connect(ac.destination);
  src.start(frame / ac.sampleRate);
  A.sources.add(src);
  src.onended = () => { A.sources.delete(src); try { g.disconnect(); } catch { /* gone */ } };
}

/** Stop every sound: the music fades out over 15 ms (so it doesn't click), then stops. */
function stopSources() {
  const ac = A.ac;
  const t = ac ? ac.currentTime : 0;
  const bus = A.bus;
  A.bus = null; // the next sound gets a new knob, so this fade never touches it
  if (bus) {
    try {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 0.015);
    } catch { /* gone */ }
  }
  const gone = [...A.sources];
  A.sources.clear();
  for (const s of gone) {
    s.onended = null;
    try { s.stop(t + 0.02); } catch { /* not started yet or done */ }
  }
  setTimeout(() => {
    for (const s of gone) { try { s.disconnect(); } catch { /* gone */ } }
    try { bus?.disconnect(); } catch { /* gone */ }
  }, 120);
}

// ---------- playing ----------

/** Play the mix round and round, from a beat. */
async function startPlay(fromBeat = 0) {
  if (S.busy === 'mic' || S.busy === 'check' || S.busy === 'save' || A.finishing || soundOff()) return;
  if (!hasClips(S.mix)) { toast(SAY.emptyPlay); return; }
  const ac = audio();
  if (!ac) { say(SAY.noSound, 'bad'); return; }
  stopHearing();
  const token = ++A.token;
  S.busy = 'play';
  paint();
  try { await ac.resume(); } catch { /* it starts on the next tap */ }
  const mix = S.mix;
  const bufs = await buffersFor(mix);
  if (token !== A.token || !onScreen()) {
    // a stop already tidied up; if nothing did (the studio went away), do it here
    if (token === A.token && S.busy === 'play') S.busy = '';
    return;
  }
  S.busy = '';
  const beat = 60 / mix.bpm;
  const beats = mixBeats(mix);
  const first = (((fromBeat % beats) + beats) % beats) * beat;
  newBus();
  A.play = { mix, bufs, plan: schedule(mix), loop: mixSeconds(mix), beat, origin: ac.currentTime + 0.08 - first, k: 0, first };
  playTick();
  clearInterval(A.timer);
  A.timer = setInterval(playTick, 100);
  paint();
}

/** Every 100 ms while playing: start what plays in the next moments, a loop at a time. */
function playTick() {
  const p = A.play;
  if (!p) return;
  if (!onScreen()) { leaveIfGone(); return; }
  while (p.origin + p.k * p.loop < A.ac.currentTime + 0.3) {
    const base = p.origin + p.k * p.loop;
    // after the first time round, a take on the loop's first beat starts its lead at the
    // very end of the loop before
    for (const e of sliceSchedule(p.plan, p.k === 0 ? p.first : -Infinity)) {
      const b = p.bufs.get(e.id);
      if (b) startSource(b, base + e.at, e.offset, e.dur, { sharp: e.kind === 'part' && e.offset === 0 });
    }
    p.k += 1;
  }
}

/** The studio went away without a redraw (the page was hidden): stop. */
function leaveIfGone() {
  stopAll();
  paint();
}

/** Where the music is in the loop now, in beats (for carrying on after an edit). */
function playBeat() {
  const p = A.play;
  if (!p) return 0;
  const beats = p.loop / p.beat;
  const b = (A.ac.currentTime - p.origin) / p.beat;
  return ((b % beats) + beats) % beats;
}

/** After an edit while playing: carry on from the same place with the new mix. */
function restartPlay() {
  const at = Math.floor(playBeat() * 4) / 4;
  stopPlay(false);
  startPlay(at);
}

/** Stop playing (and a part being heard). */
function stopPlay(draw = true) {
  A.token += 1;
  clearInterval(A.timer);
  A.timer = 0;
  A.play = null;
  if (S.busy === 'play') S.busy = '';
  stopSources();
  stopHearing(false);
  cancelAnimationFrame(A.raf);
  if (draw) paint();
  else updateWake();
}

/** Every frame while playing or recording: move the playhead (and the recording's red box). */
function follow() {
  cancelAnimationFrame(A.raf);
  const step = () => {
    const head = document.querySelector('#studio .st-head');
    const beats = mixBeats(S.mix);
    const at = headBeat();
    if (at == null) { if (head) head.hidden = true; return; }
    if (head) {
      head.hidden = false;
      head.style.left = `${pct(at, beats)}%`;
    }
    const box = document.querySelector('#studio .st-recbox');
    if (box && A.rec) box.style.width = `${pct(Math.max(0, at - A.rec.beat), beats)}%`;
    A.raf = requestAnimationFrame(step);
  };
  A.raf = requestAnimationFrame(step);
}

/** Where the playhead is, in beats, as the kid hears it (null when nothing plays). */
function headBeat() {
  if (!A.ac) return null;
  const heard = A.ac.currentTime - outLag();
  if (A.play) {
    const beats = A.play.loop / A.play.beat;
    // before the first sound is heard, the head waits on the beat it starts from
    const b = Math.max(A.play.first, heard - A.play.origin) / A.play.beat;
    return ((b % beats) + beats) % beats;
  }
  const r = A.rec;
  if (r?.kind === 'take') return Math.min(r.beat + r.room, Math.max(r.beat, (heard - r.origin) / r.beatSec));
  return null;
}

/** Hear one part on the shelf (its first four bars), or stop it. */
async function hear(song, part) {
  const key = `${song}|${part}`;
  if (S.hearing === key) { stopHearing(); return; }
  // not while the microphone gets ready: stopping would quietly cancel the recording
  if (heldNow() || soundOff()) return;
  const ac = audio();
  if (!ac) { say(SAY.noSound, 'bad'); return; }
  stopPlay(false);
  S.hearing = key;
  paint();
  try { await ac.resume(); } catch { /* the next tap */ }
  const src = sourceOf(song);
  const bpm = hasClips(S.mix) ? S.mix.bpm : src.bpm;
  const b = await partBuffer(song, part, bpm);
  if (S.hearing !== key) return;
  if (!b) { S.hearing = ''; say(SAY.partBroken); return; }
  const len = Math.min(b.duration, (4 * src.meter * 60) / bpm);
  newBus();
  startSource(b, ac.currentTime + 0.05, 0, len, { sharp: true });
  clearTimeout(A.hearTimer);
  A.hearTimer = setTimeout(() => { if (S.hearing === key) stopHearing(); }, len * 1000 + 150);
}

/** Stop the part being heard. */
function stopHearing(draw = true) {
  clearTimeout(A.hearTimer);
  if (!S.hearing) return;
  S.hearing = '';
  if (!A.play) stopSources();
  if (draw) paint();
}

// ---------- recording ----------

/** Why the microphone didn't open, in kind words. */
function micTrouble(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return SAY.micRefused;
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError' || e?.name === 'NotSupported') return SAY.noMic;
  return SAY.micBroken;
}

/** Open the microphone with the voice filters off (they spoil a piano). */
function openMic() {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(Object.assign(new Error('no microphone'), { name: 'NotSupported' }));
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
}

/**
 * Listen to the microphone through the 'kq-tap' worklet: every block comes with the audio
 * clock's frame number, so every sample's time is known. Returns { blocks, lastFrame(), stop() }.
 */
async function capture(ac, stream) {
  A.worklet ||= ac.audioWorklet.addModule(new URL('./listen-tap.js', import.meta.url)).catch((e) => { A.worklet = null; throw e; });
  await A.worklet;
  const src = ac.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(ac, 'kq-tap', { processorOptions: { size: Math.round(ac.sampleRate / 100), stamp: true } });
  const mute = ac.createGain();
  mute.gain.value = 0; // keeps the worklet running without playing the microphone out loud
  src.connect(tap).connect(mute).connect(ac.destination);
  const blocks = [];
  tap.port.onmessage = ({ data }) => { if (data?.samples) blocks.push(data); };
  return {
    blocks,
    lastFrame: () => (blocks.length ? blocks[blocks.length - 1].end : 0),
    stop() {
      tap.port.onmessage = null;
      try { src.disconnect(); tap.disconnect(); mute.disconnect(); } catch { /* gone */ }
      stream.getTracks().forEach((t) => t.stop()); // the microphone light goes out
    },
  };
}

/** Open the microphone and start listening; says why not and returns null when it can't. */
async function listen(ac, token) {
  let stream;
  try { stream = await openMic(); } catch (e) { S.busy = ''; say(micTrouble(e), 'bad'); return null; }
  if (token !== A.token || !onScreen()) {
    // given up meanwhile (a stop, or the studio went away): Record can be pressed again
    stream.getTracks().forEach((t) => t.stop());
    if (S.busy === 'mic' || S.busy === 'check') { S.busy = ''; paint(); }
    return null;
  }
  try {
    await ac.resume();
    return await capture(ac, stream);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    S.busy = '';
    say(SAY.cantRecord, 'bad');
    return null;
  }
}

/**
 * How late the microphone hears what the tablet plays: what was last measured (from a take's
 * count-in or the timing check), or a guess. It was measured through the speaker, so with
 * headphones the speaker's lateness then is swapped for the headphones' now.
 */
function roundTrip(phones = S.phones) {
  const d = readNumber(DELAY_KEY);
  if (d == null || d < 0 || d > 0.5) return guessDelay(A.ac?.outputLatency, A.ac?.baseLatency);
  return phones ? phonesDelay(d, readNumber(OUT_KEY) ?? 0, outLag()) : d;
}

/** Remember how late the microphone was, and how late the speaker was at that moment. */
function keepDelay(delay) {
  keep(DELAY_KEY, delay.toFixed(4));
  keep(OUT_KEY, outLag().toFixed(4));
}

/** Record onto the chosen spot: a bar of clicks to count in, then until Stop or the room runs out. */
async function startRecording() {
  if (A.rec || A.finishing) return;
  if (S.busy === 'play') stopPlay(false); // Play was still getting ready: record instead
  if (S.busy) return;
  if (soundOff()) return;
  const mix = S.mix;
  const spot = currentSpot();
  if (!spot) { say(SAY.full); return; }
  const room = spot.room;
  if (room < 1) { say(SAY.spotTaken); return; }
  if (room < 2) { say(`There is only ${beatsWord(room)} of room there. Tap an emptier place first.`); return; }
  const ac = audio();
  if (!ac) { say(SAY.noSound, 'bad'); return; }
  stopPlay(false);
  const token = ++A.token;
  S.busy = 'mic';
  S.note = '';
  paint();
  const cap = await listen(ac, token);
  if (!cap) return;
  const phones = S.phones;
  const bufs = phones ? await buffersFor(mix) : null;
  if (token !== A.token || !onScreen()) {
    cap.stop();
    if (S.busy === 'mic') { S.busy = ''; paint(); }
    return;
  }
  // the clicks are counted in whole audio frames, so each one is exactly the same sound
  const rate = ac.sampleRate;
  const beat = 60 / mix.bpm;
  const t0Frame = Math.ceil((ac.currentTime + 0.3) * rate);
  const plan = clickPlan(t0Frame, rate, beat, mix.meter, room, spot.beat);
  for (const c of [...plan.countIn, ...plan.clicks]) click(c.frame, c.hz);
  const t0 = t0Frame / rate;
  const at = plan.from / rate; // the chosen beat
  const end = at + room * beat;
  const origin = at - spot.beat * beat;
  if (bufs) {
    newBus();
    for (const e of sliceSchedule(schedule(mix), spot.beat * beat, (spot.beat + room) * beat)) {
      const b = bufs.get(e.id);
      if (b) startSource(b, origin + e.at, e.offset, e.dur);
    }
  }
  A.rec = {
    kind: 'take', token, track: spot.track, beat: spot.beat, room, t0, at, end, origin, beatSec: beat, meter: mix.meter, cap,
    delay: roundTrip(phones), phones, countIn: plan.countIn, clicks: plan.clicks, from: plan.from,
  };
  S.busy = '';
  clearInterval(A.timer);
  A.timer = setInterval(recTick, 50);
  paint();
  follow();
}

/** While recording: count in, and finish when the room runs out. */
function recTick() {
  const r = A.rec;
  if (!r || r.kind !== 'take') return;
  if (!onScreen()) { leaveIfGone(); return; }
  const now = A.ac.currentTime;
  if (now >= r.end) { finishRecording({ byItself: true }); return; }
  const label = document.querySelector('#studio .st-rec-label');
  if (!label) return;
  const heard = now - outLag();
  const left = Math.ceil((r.at - heard) / r.beatSec);
  label.textContent = heard < r.at ? `Get ready… ${Math.max(1, Math.min(r.meter, left))}` : '■ Stop recording';
}

/**
 * Stop recording and keep the take: lined up with its beat, made loud enough, put on its track.
 * `down` is when the finger landed on Stop (the audio clock), `byItself` when the room ran
 * out, `hurry` when the kid left: then it is kept at once with the sound there is so far.
 * Once it has begun, nothing stops it: the take goes in the kid's draft even if the studio
 * has closed or another kid sat down meanwhile. Edits wait until it is kept.
 */
async function finishRecording({ down = null, byItself = false, hurry = false } = {}) {
  const r = A.rec;
  if (!r || r.kind !== 'take' || r.finishing) return;
  r.finishing = true;
  r.hurry = hurry;
  clearInterval(A.timer);
  const ac = A.ac;
  const rate = ac.sampleRate;
  let stopAt = r.end;
  if (!byItself) {
    // what the kid heard when the finger landed, less the finger's own delay
    const heard = Math.min(down ?? ac.currentTime, ac.currentTime) - outLag();
    if (heard <= r.at + 0.05) { cancelRecording(); say(SAY.stoppedEarly); return; }
    stopAt = Math.min(r.end, Math.max(heard - TOUCH_LAG, r.at + r.beatSec));
  }
  let to = Math.round(stopAt * rate);
  stopSources();
  A.rec = null;
  A.finishing = r;
  S.busy = 'save';
  cancelAnimationFrame(A.raf);
  const kid = S.kid;
  paint();
  try {
    // the microphone hears the last beats a moment later: wait for them (1.5 seconds at most)
    const heardLate = countInDelay(joinBlocks(r.cap.blocks), rate, r.countIn.map((c) => c.frame), r.from) ?? r.delay;
    const need = to + Math.round((heardLate + 0.15) * rate);
    for (let i = 0; i < 30 && r.cap.lastFrame() < need && !r.hurry; i += 1) await wait(50);
    r.cap.stop();
    // in a hurry, the take ends where the microphone's sound ends
    if (r.cap.lastFrame() < need) to = Math.min(to, r.cap.lastFrame() - Math.round(heardLate * rate));
    if (to <= r.from + 0.05 * rate) { if (!r.hurry) say(SAY.stoppedEarly); return; }
    // line the take up (timed from its own count-in when the clicks were heard) and take the clicks out
    const made = makeTake(joinBlocks(r.cap.blocks), { rate, countIn: r.countIn, clicks: r.clicks, from: r.from, to, guess: r.delay, phones: r.phones, lead: LEAD });
    if (made.measured && !r.phones) keepDelay(made.delay);
    if (!made.played) { say(SAY.nothingHeard); return; }
    const { samples } = normalise(fadeEnds(made.samples, rate));
    let id;
    try { id = await saveTake(kid, samples, rate, LEAD); } catch { say(SAY.keepFailed, 'bad'); return; }
    const beats = (samples.length / rate - LEAD) / r.beatSec;
    if (S.kid !== kid) {
      // another kid sat down meanwhile: the take goes in its own kid's draft
      const { draft } = await loadMixes(kid, true);
      const res = addTake(draft || newMix(), r.track, id, beats, r.beat, { lead: LEAD });
      if (!res.error) await saveMix(kid, 'draft', res.mix);
      return;
    }
    S.takes.set(id, { rate, samples, lead: LEAD });
    const res = addTake(S.mix, r.track, id, beats, r.beat, { lead: LEAD });
    if (res.error) { say(res.error); return; }
    S.spot = { ...S.spot, picked: false };
    commit(res.mix, { select: res.id, said: S.on ? `Nice playing! Your take is on track ${r.track + 1}.` : '' });
    await flushSave();
  } catch {
    say(SAY.keepFailed, 'bad');
  } finally {
    r.cap.stop();
    if (A.finishing === r) A.finishing = null;
    if (S.busy === 'save') S.busy = '';
    paint();
    updateWake();
  }
}

/** Stop a recording or a timing check without keeping anything (the kid left). */
function cancelRecording() {
  const r = A.rec;
  if (!r) return;
  A.rec = null;
  A.token += 1;
  clearInterval(A.timer);
  stopSources();
  r.cap?.stop();
  cancelAnimationFrame(A.raf);
}

/**
 * The timing check: play 8 loud clicks half a second apart through the speaker while the
 * microphone listens, find them in the recording, and keep how late they arrived.
 */
async function timingCheck() {
  if (A.rec || A.finishing || S.busy) return;
  if (soundOff()) return;
  const ac = audio();
  if (!ac) { say(SAY.noSound, 'bad'); return; }
  stopPlay(false);
  const token = ++A.token;
  S.busy = 'check';
  say('Listen… 8 clicks are coming. Keep the room quiet.');
  const cap = await listen(ac, token);
  if (!cap) return;
  const t0 = ac.currentTime + 0.5;
  const clicks = Array.from({ length: 8 }, (_, i) => t0 + i * 0.5);
  for (const t of clicks) loudClick(t);
  A.rec = { kind: 'check', token, cap };
  paint();
  updateWake();
  const done = t0 + clicks.length * 0.5 + 0.4 + roundTrip();
  for (let i = 0; i < 120 && ac.currentTime < done && A.rec?.token === token; i += 1) await wait(100);
  if (A.rec?.token !== token) { if (S.busy === 'check') { S.busy = ''; paint(); } return; } // the kid left
  A.rec = null;
  cap.stop();
  S.busy = '';
  const joined = joinBlocks(cap.blocks);
  const heard = findOnsets(joined.samples, ac.sampleRate).map((t) => joined.first / ac.sampleRate + t);
  // most clicks must be heard at the same delay (a beep that isn't ours only matches some)
  const delay = echoDelay(clicks, heard, { need: clicks.length - 2 });
  if (delay == null) { say(SAY.checkFail, 'bad'); return; }
  keepDelay(delay);
  say(SAY.checkOk, 'good');
}

/** A sharp, loud click for the timing check, straight to the speaker. */
function loudClick(when) {
  const ac = A.ac;
  const o = ac.createOscillator();
  o.type = 'square';
  o.frequency.value = 2400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.6, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.012);
  o.connect(g).connect(ac.destination);
  o.start(when);
  o.stop(when + 0.02);
  A.sources.add(o);
  o.onended = () => { A.sources.delete(o); try { g.disconnect(); } catch { /* gone */ } };
}

globalThis.document?.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // a take under way is kept; the screen lock goes by itself
    if (A.play || A.rec || A.finishing || S.hearing || S.busy) { stopAll(); paint(); }
  } else {
    W.refused = false;
    updateWake();
  }
});

// ---------- my mixes ----------

/** Save the desk's mix in a slot (asks first when that slot holds another mix). */
function saveSlot(i) {
  if (!hasClips(S.mix)) { toast(SAY.emptySave); return; }
  const there = S.slots[i];
  const go = async () => {
    const kid = S.kid;
    const name = /^(My mix|Mix \d)$/.test(S.mix.name) ? `Mix ${i + 1}` : S.mix.name;
    const mix = { ...S.mix, name };
    S.mix = mix;
    pending = { kid, mix };
    await flushSave();
    try { await saveMix(kid, i, mix); } catch { toast(SAY.saveFailed); return; }
    if (S.kid !== kid) return;
    S.slots[i] = mix;
    S.clean = fingerprint(mix);
    paint();
    toast(`Saved! Your mix is kept as ${name}.`);
    sweep();
    forgetTakes();
  };
  if (there && fingerprint(there) !== fingerprint(S.mix)) {
    confirmModal({ title: `Save over ${there.name}?`, text: `The mix that is there now will be gone.`, yes: 'Save over it', onYes: go });
  } else go();
}

/** Put a saved mix on the desk (asks first when the desk has changes that aren't saved). */
function openSlot(i) {
  const m = S.slots[i];
  if (!m) return;
  const go = () => {
    stopPlay(false);
    rememberUndo();
    S.mix = { ...m, tracks: m.tracks.map((t) => t.map((c) => ({ ...c }))) };
    S.clean = fingerprint(S.mix);
    S.sel = null;
    S.spot = { track: 0, beat: 0, picked: false };
    S.badges = badges(S.mix);
    S.panel = '';
    autosave();
    forgetTakes();
    paint();
    loadTakes(S.mix);
    toast(`${m.name} is on your desk.`);
  };
  if (dirty()) confirmModal({ title: `Open ${m.name}?`, text: 'The mix on your desk isn\'t saved yet. It will be replaced.', yes: 'Open it', onYes: go });
  else go();
}

/** Throw a saved mix away, after asking. */
function deleteSlot(i) {
  const m = S.slots[i];
  if (!m) return;
  confirmModal({
    title: `Delete ${m.name}?`,
    text: 'It will be gone for good.',
    yes: 'Delete it',
    danger: true,
    onYes: async () => {
      const kid = S.kid;
      await flushSave();
      try { await deleteMix(kid, i); } catch { toast(SAY.deleteFailed); return; }
      if (S.kid !== kid) return;
      S.slots[i] = null;
      if (S.clean === fingerprint(m)) S.clean = '';
      forgetTakes();
      paint();
      sweep();
    },
  });
}

/** A clean desk (asks first when the desk has changes that aren't saved). */
function newDesk() {
  const go = async () => {
    stopPlay(false);
    rememberUndo();
    S.mix = newMix();
    S.clean = '';
    S.sel = null;
    S.spot = { track: 0, beat: 0, picked: false };
    S.badges = [];
    S.panel = '';
    pending = { kid: S.kid, mix: S.mix };
    await flushSave();
    forgetTakes();
    paint();
    sweep();
  };
  if (dirty()) confirmModal({ title: 'Start a new mix?', text: 'The mix on your desk isn\'t saved yet. It will be gone.', yes: 'Start a new one', danger: true, onYes: go });
  else go();
}

// ---------- taps ----------

export const studioActions = {
  'studio-back': () => { leave(); ui.view = 'kid'; render(); },
  'st-play': () => {
    if (A.play || S.busy === 'play') stopPlay();
    else if (!A.rec) startPlay(0);
  },
  'st-rec': () => {
    const down = A.down && performance.now() - A.down.t < 1500 ? A.down.at : null;
    A.down = null;
    if (A.rec?.kind === 'take') finishRecording({ down });
    else startRecording();
  },
  'st-undo': () => { if (!busyNow()) undo(); },
  'st-bars': (el) => {
    if (busyNow()) return;
    const d = Number(el.dataset.d);
    const want = S.mix.bars + d;
    if (want < 2) { toast('That\'s the shortest loop: 2 bars.'); return; }
    if (want > maxBars(S.mix.bpm, S.mix.meter)) { toast('That\'s the longest loop. A loop can be 30 seconds at most.'); return; }
    const r = setBars(S.mix, want);
    if (r.error) { toast(r.error); return; }
    commit(r.mix);
  },
  'st-bpm': (el) => {
    if (busyNow()) return;
    const want = S.mix.bpm + Number(el.dataset.d) * BPM_STEP;
    const r = setBpm(S.mix, want);
    if (r.error) { toast(r.error); return; }
    if (r.mix.bpm === S.mix.bpm) { toast(want < S.mix.bpm ? 'That\'s as slow as it goes.' : 'That\'s as fast as it goes.'); return; }
    commit(r.mix);
  },
  'st-phones': () => {
    S.phones = !S.phones;
    keep(PHONES_KEY, S.phones ? 1 : 0);
    paint();
    toast(S.phones ? 'Headphones on: you\'ll hear your whole mix while you record.' : 'Headphones off: you\'ll hear soft clicks while you record.');
  },
  'st-panel': (el) => { S.panel = S.panel === el.dataset.panel ? '' : el.dataset.panel; paint(); },
  'st-note-close': () => { S.note = ''; paint(); },
  'st-add': (el) => {
    if (busyNow()) return;
    const spot = currentSpot();
    if (!spot) { toast(SAY.full); return; }
    const r = addPart(S.mix, spot.track, el.dataset.song, el.dataset.part, spot.beat);
    if (r.error) { toast(r.error); return; }
    S.spot = { ...S.spot, picked: false };
    commit(r.mix, { select: r.id });
  },
  'st-hear': (el) => hear(el.dataset.song, el.dataset.part),
  'st-nudge': (el) => { if (!busyNow()) nudge(el.dataset.do); },
  'st-copy': () => {
    if (busyNow() || S.sel == null) return;
    const r = copyClip(S.mix, S.sel);
    if (r.error) { toast(r.error); return; }
    commit(r.mix, { select: r.id });
  },
  'st-delete': () => {
    if (busyNow() || S.sel == null) return;
    commit(removeClip(S.mix, S.sel).mix, { select: null });
  },
  'st-unselect': () => { S.sel = null; paint(); },
  'st-slot-save': (el) => { if (!busyNow()) saveSlot(Number(el.dataset.slot)); },
  'st-slot-open': (el) => { if (!busyNow()) openSlot(Number(el.dataset.slot)); },
  'st-slot-del': (el) => { if (!busyNow()) deleteSlot(Number(el.dataset.slot)); },
  'st-new': () => { if (!busyNow()) newDesk(); },
  'st-check': () => { if (!busyNow()) timingCheck(); },
};

/** What the studio's sound is doing (for tests): { playing, recording, sounds }. */
export function studioSound() {
  return { playing: Boolean(A.play), recording: Boolean(A.rec), sounds: A.sources.size };
}

/** The clicks of the recording under way (for tests): { rate, from, countIn, clicks } or null. */
export function studioRec() {
  const r = A.rec;
  return r?.kind === 'take' ? { rate: A.ac.sampleRate, from: r.from, countIn: r.countIn, clicks: r.clicks } : null;
}

/** The music house's studio desk: open the studio. */
export function openStudio() {
  ui.view = 'studio';
  render();
  window.scrollTo(0, 0);
}
