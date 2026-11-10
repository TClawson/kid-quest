// The music house's recording studio: a mixing desk where a kid builds a short loop (30
// seconds at most) on four tracks, from ready-made parts of the game's songs (the tune, its
// hook, the sparkle, the bass, the drums, their kick and snare or cymbals), from backing
// tracks that belong to no song (beats, cymbals, bass lines, chords and sparkles on a chord
// loop the kid picks, in the mix's key), and from their own piano, recorded with the tablet's
// microphone. Clips can be moved, copied, trimmed and thrown away, by tapping or dragging,
// and ready-made ones remixed: another voice, higher or lower, another drum kit (remix.js).
// A take can be turned into notes (the Note-o-Matic: listener.js hears the piano keys in a
// Worker, notomatic.js offers three readings), and then remixed like any clip with notes.
// The mix on the desk is kept as a draft, and a kid can keep a few mixes (studio-store.js,
// on this tablet only). The rules live in studiorules.js, the sound arithmetic in
// studio-audio.js. It opens once today's chores are done. A parent can also open a test
// desk from Settings (behind the PIN): every song, open any time, with mixes of its own.
//
// app.js redraws the whole page whenever a view's HTML changes, so viewStudio() returns a
// small shell that only depends on the kid, and mountStudio() draws everything inside it
// from the state kept here. A redraw never stops the music, a recording or a drag.
// Shared things come from ctx.js; app.js adds studioActions to its actions.

import { ui, state, esc, kidById, render, progressFor, toast, viewKid, today, confirmModal } from './ctx.js';
import { studioOpen, musicTier, MUSIC_TIERS } from './musicrules.js';
import { keyLabel } from './sheetmusic.js';
import { treasureFound } from './treasure.js';
import { songParts, renderPart, renderEvents, partStyle } from './music.js';
import {
  TRACKS, MIX_SLOTS, PART_NAMES, BPM_RANGE, BACKING_BPM, newMix, sourceOf, maxBars, mixBeats, mixSeconds, addPart, addTake, moveClip,
  trimClip, copyClip, removeClip, setBars, setBpm, isFree, roomAt, bestSpot, findClip, keyFits, schedule, badges, shelfSongs,
  addBacking, setLoop, setVoice, setKit, shiftClip, moveIntoKey, clipFits, clipKey, remixed, splitShift, backingBeats, backingSwing,
  setTrackVolume, trackVolume, trackGain, VOLUME_TOP, USUAL_VOLUME, takeToNotes, clipSwing, readingVoice, NOTES_VOICE,
} from './studiorules.js';
import { READINGS, readings } from './notomatic.js';
import { VOICES, KITS, LOOPS, LOOP_IDS, BACKING, BACKING_GROUPS, backingEvents } from './studiokit.js';
import { partEvents, clipSound, backingKey, keyTonic } from './remix.js';
import { loadMixes, saveMix, deleteMix, saveTake, loadTake, sweepTakes } from './studio-store.js';
import {
  CLICK, normalise, findOnsets, joinBlocks, guessDelay, sliceSchedule, pct, beatAt, waveLine, echoDelay, countInDelay,
  clickWave, clickPlan, makeTake, fadeEnds, phonesDelay, softClip, usableDelay, stopPoint, firstPass, MOST_DELAY,
} from './studio-audio.js';
import { openMic, capture } from './mic.js';

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
  nothingToRedo: 'There is nothing to redo.',
  undone: 'Took that back.',
  undoneTake: 'Took your take away. Tap Redo to bring it back.',
  redone: 'Put it back.',
  redoneTake: 'Your take is back.',
  draftFailed: 'I couldn\'t save your mix. This tablet may be full.',
  takeNotKept: 'Your take is on your desk, but I couldn\'t keep it on this tablet. This tablet may be full.',
  cantOpen: 'I couldn\'t open your mixes just now.',
  readyPlay: 'Getting the music ready. It starts in a moment.',
  readyRec: 'Getting the music ready for your recording. The clicks start in a moment.',
  readyClip: 'Getting the new sound ready…',
  nomListening: 'Listening to your take…',
  nomNothing: 'I couldn\'t hear piano notes in that take. Try again with the tablet close to the piano.',
  nomBroken: 'Something went wrong while I was listening. Please try again.',
  nomMissing: 'That recording is missing from this tablet, so I can\'t listen to it.',
  nomNoBand: 'Play a longer tune to get a band.',
  nomOwnSpeed: 'You played at your own speed, so the tidied notes follow your playing, not the clicks.',
  nomDone: 'Your take became notes. Pick a voice for it, or tap Undo to get your recording back.',
};

/** "1 beat", "16 beats". */
const beatsWord = (n) => `${n} beat${n === 1 ? '' : 's'}`;

/** "1 octave", "2 octaves". */
const octavesWord = (n) => `${n} octave${n === 1 ? '' : 's'}`;

const PART_ICONS = { lead: '🎵', arp: '✨', bass: '🎸', drums: '🥁', hook: '🎣', beat: '🪘', cymbals: '🔔' };
const GROUP_ICONS = { beats: '🥁', cymbals: '🔔', bass: '🎸', chords: '🎹', sparkles: '✨' };
const STICKER_ICONS = { take: '🎤', duet: '🤝', band: '🎺', remix: '🔀', match: '🎯', solo: '🦸', remixer: '🎨', house: '🏠', notes: '🎹', leader: '🎼' };
/** A clip of the kid's own notes, by its role. */
const NOTES_WORDS = { tune: { icon: '🎹', name: 'My notes', song: 'Your playing' }, band: { icon: '🎺', name: 'My band', song: 'Made for your tune' } };
const DELAY_KEY = 'kidquest.studio.delay';
const OUT_KEY = 'kidquest.studio.delay.out'; // how late the speaker was when the delay was measured
const PHONES_KEY = 'kidquest.studio.phones';
const BPM_STEP = 5;
const MOST_PARTS = 10;  // rendered parts and backing tracks kept ready (a part is a whole song of sound)
const MOST_WAVES = 200; // little pictures of takes kept ready
const MOST_UNDO = 20;   // mixes Undo can step back through
const LEAD = 0.06;      // seconds kept from before a take's beat, so an early note keeps its start
const TOUCH_LAG = 0.08; // how long a finger takes to press Stop after the kid means to
const UNDO_REST = 600;  // ms after a take is kept when Undo and Redo don't listen (a second tap on Stop)

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

// ---------- who is at the desk ----------

/** The parent's test desk (Settings): its mixes and takes are kept under this id, never a kid's. */
export const TEST_DESK = 'parent-test';
const TEST_COLOR = '#868e96';

/**
 * Who sits at desk `id` (a kid's id or TEST_DESK): { title, color, open, songs(), back, backLabel }.
 * A kid's desk has their songbook's songs, opens once today's chores are done and goes back to
 * their map. The test desk has every song, opens any time and goes back to Settings. Stickers
 * are worked out from the mix on the desk and kept nowhere else, so no desk changes a kid.
 * Null when there is no such kid.
 */
function deskOf(id) {
  if (id === TEST_DESK) {
    return {
      title: 'Test desk', color: TEST_COLOR, open: true, songs: () => shelfSongs(MUSIC_TIERS.length),
      back: { view: 'parent', tab: 'settings' }, backLabel: 'Back to Settings',
    };
  }
  const kid = kidById(id);
  if (!kid) return null;
  return {
    title: `${kid.name}'s mixing desk`, color: kid.color, open: studioOpen(state, kid, today()).open,
    songs: () => shelfSongs(musicTier(progressFor(kid)), treasureFound(state.log, kid.id).maps),
    back: { view: 'kid' }, backLabel: 'Back to the music house',
  };
}

/** Whose desk the studio shows: the test desk when a parent opened it from Settings, else the kid's. */
const deskId = () => (ui.studioTest ? TEST_DESK : ui.kidId);

// ---------- what the studio remembers while the app is open ----------

const S = {
  on: false,          // the studio is on screen
  kid: null,          // whose desk this is: a kid's id or TEST_DESK
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
  redo: [],           // the mixes Undo stepped back from, the newest last
  broken: false,      // the kid's mixes couldn't be read: the desk waits for Try again
  saveWarned: false,  // the kid was told this visit that the draft couldn't be saved
  hearing: '',        // the part being heard on the shelf ('song|part', 'backing|pattern'), or a clip
  loop: 'sunny',      // the chords the backing tracks play (studiokit.js LOOPS)
  chooser: null,      // the voice or kit chooser open for a clip: { id, what: 'voice' or 'kit' }
  said: '',           // what the last remix button did, shown under the open chooser (a toast would cover it)
  waiting: '',        // 'play' or 'rec' while Play or Record waits for sounds to be made
  hearWait: '',       // the sound being heard (S.hearing) while it is being made
  volTrack: null,     // the track whose loudness panel is open, or null
  unmuteTo: [],       // by track: the level it had when it was muted, for Unmute (not kept in the mix)
  phones: readNumber(PHONES_KEY) === 1,
  takes: new Map(),   // take id -> { rate, samples, lead }, or null when it is gone
  waves: new Map(),   // a take's little picture, by take and stretch
  nom: null,          // the Note-o-Matic's panel: { id (the take's clip), take, phase, progress, result, pick, bufs }
  heard: new Map(),   // take id -> the notes heard in it (kept while the app is open, so a take is listened to once)
};

// the Note-o-Matic's listening under way: its Worker (null when listening on the screen's own thread)
const N = { worker: null };

// the sound: one AudioContext for playing and recording
const A = {
  ac: null, master: null,
  hearKey: '',         // the sound (soundKey) being heard, so it is wanted while it is made
  parts: new Map(),    // a clip's sound at a speed (soundKey) -> Promise<AudioBuffer|null>, the last used at the end
  buffers: new Map(),  // 'take|id' -> AudioBuffer
  clicks: new Map(),   // the metronome's click for each note -> AudioBuffer
  sources: new Set(),  // everything started, so Stop stops it at once
  timer: 0, raf: 0, hearTimer: 0,
  token: 0,            // bumped by every stop, so a start that is still getting ready gives up
  play: null,          // { mix, bufs, plan, loop, beat, origin, k, first }
  rec: null,           // a recording or timing check under way
  finishing: null,     // a recording that stopped and is being kept
  bus: null,           // the volume knob for this run of play, faded down when it stops
  lanes: null,         // each track's loudness for this run of play (gain nodes into the knob), or null
  down: null,          // when a finger landed on Record or Stop: { at (audio clock), t }
  keptAt: -1e9,        // when the last take was kept (performance.now())
};

// the screen stays on while recording, checking the timing or playing
const W = { lock: null, asking: false, refused: false };

let drag = null;       // a clip being dragged: { pointer, x0, y0, width, track, id, mode, moved, ghost }
let saveTimer = 0;
let pending = null;    // the draft waiting to be saved: { kid, mix }

const hasClips = (mix) => mix.tracks.some((t) => t.length);
const fingerprint = (mix) => JSON.stringify([mix.bpm, mix.bars, mix.meter, mix.tracks, ...(mix.vols ? [mix.vols] : [])]);
/** The music of a mix without the tracks' loudness: a change to only that needn't start the music again. */
const musicOf = (mix) => JSON.stringify([mix.bpm, mix.bars, mix.meter, mix.key, mix.tracks]);
const dirty = () => hasClips(S.mix) && fingerprint(S.mix) !== S.clean;
const onScreen = () => S.on && ui.view === 'studio' && document.visibilityState !== 'hidden';
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

// ---------- the screen ----------

/** The studio screen: a small shell; mountStudio fills it. A kid's is locked until today's chores are done. */
export function viewStudio() {
  const id = deskId();
  const desk = deskOf(id);
  if (!desk?.open) { ui.studioTest = false; ui.view = 'kid'; return viewKid(); }
  return `
    <div class="screen studio-screen" style="--kid:${esc(desk.color)}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="studio-back" aria-label="${esc(desk.backLabel)}">←</button>
        <div class="kid-title"><b>🎚️ Recording studio</b><small>${esc(desk.title)}</small></div>
      </header>
      <div id="studio" class="studio" data-kid="${esc(id)}"><p class="muted">Getting your studio ready…</p></div>
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
  closeNom(false);
  stopAll();
  const kid = S.kid;
  S.undo = []; // Undo and Redo are for one visit
  S.redo = [];
  const keep = takeIds(S.mix);
  // nothing is swept when the kid's mixes couldn't be read this visit
  if (!S.broken) flushSave().then(() => (kid ? sweepTakes(kid, { keep }) : 0)).catch(() => {});
  S.saveWarned = false;
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
  if (r?.kind === 'take' && A.ac.currentTime - outLag() > r.at) finishRecording({ hurry: true });
  else if (r) cancelRecording();
  if (S.busy !== 'save') S.busy = '';
  stopPlay();
  updateWake();
}

/** Keep the screen on while something is under way in the studio, and let it go after. */
function updateWake() {
  const want = S.on && document.visibilityState !== 'hidden' && Boolean(A.play || A.rec || A.finishing || S.busy === 'check' || S.busy === 'save' || S.nom?.phase === 'listen');
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

/** Throw away this kid's takes that no mix uses (the desk's, Undo's and Redo's are kept too). */
function sweep(kid = S.kid) {
  if (kid && !S.broken) sweepTakes(kid, { keep: [S.mix, ...S.undo, ...S.redo].flatMap(takeIds) }).catch(() => {});
}

/** A new kid at the desk: their draft and saved mixes. */
async function openDesk(kid) {
  closeNom(false);
  stopAll();
  flushSave();
  Object.assign(S, { kid, loading: true, broken: false, mix: newMix(), slots: [], clean: '', sel: null, volTrack: null, unmuteTo: [], panel: '', note: '', badges: [], pop: '', undo: [], redo: [], saveWarned: false, spot: { track: 0, beat: 0, picked: false } });
  S.takes.clear();
  S.waves.clear();
  paint();
  // read strictly: an empty desk after a failed read would be saved over the kid's real draft
  let got = null;
  for (let tries = 0; tries < 2 && !got; tries += 1) {
    try { got = await loadMixes(kid, true); } catch { got = null; }
    if (S.kid !== kid) return;
  }
  S.loading = false;
  if (!got) { S.broken = true; paint(); return; } // no saving and no sweeping until Try again works
  S.mix = got.draft || newMix();
  syncLoop();
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

/** The chords the mix's backing tracks play, when it has some: the chord picker shows them. */
function syncLoop() {
  const c = S.mix.tracks.flat().find((x) => x.kind === 'backing' && clipSound(x) === 'notes');
  if (c && LOOPS[c.loop]) S.loop = c.loop;
}

/** The takes a mix uses, by id. */
const takeIds = (mix) => mix.tracks.flat().filter((c) => c.kind === 'take').map((c) => c.take);

/** Forget the sound of takes that neither the desk's mix, a saved mix, Undo nor Redo uses. */
function forgetTakes() {
  const used = new Set([S.mix, ...S.slots, ...S.undo, ...S.redo].filter(Boolean).flatMap(takeIds));
  for (const id of [...S.takes.keys()]) {
    if (used.has(id)) continue;
    S.takes.delete(id);
    A.buffers.delete(`take|${id}`);
    for (const k of [...S.waves.keys()]) if (k.startsWith(`${id}|`)) S.waves.delete(k);
  }
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
  if (S.chooser && S.chooser.id !== S.sel) S.chooser = null; // a chooser is for the picked clip
  if (!S.chooser) S.said = '';
  if (S.broken) {
    el.innerHTML = `<div class="st-note bad st-broken" role="alert"><span>${esc(SAY.cantOpen)}</span><button class="btn small-btn" data-action="st-retry">Try again</button></div>`;
    return;
  }
  el.innerHTML = `${transportHtml()}${S.note ? noteHtml() : ''}${S.panel === 'mixes' ? mixesHtml() : ''}${S.panel === 'help' ? helpHtml() : ''}
    ${timelineHtml()}${toolsHtml()}${stickersHtml()}${shelfHtml()}`;
  S.pop = '';
  placeEdges();
  if (A.play || A.rec) follow();
  updateWake();
}

/**
 * Where the picked clip's edge handles go. Each is 40 px wide to a finger: inside a wide clip,
 * and outside a narrow one where the track is free (never over another clip). A narrow clip
 * always keeps a strip of its middle to drag, so a handle with no room outside gets smaller.
 */
function placeEdges() {
  const clip = document.querySelector('#studio .st-clip.sel');
  if (!clip) return;
  const lane = clip.parentElement;
  const L = lane.getBoundingClientRect();
  const r = clip.getBoundingClientRect();
  let leftEnd = L.left + lane.clientLeft;
  let rightEnd = L.left + lane.clientLeft + lane.clientWidth;
  for (const other of lane.querySelectorAll('.st-clip')) {
    if (other === clip) continue;
    const o = other.getBoundingClientRect();
    if (o.right <= r.left + 1) leftEnd = Math.max(leftEnd, o.right);
    if (o.left >= r.right - 1) rightEnd = Math.min(rightEnd, o.left);
  }
  const w = r.width;
  const want = 40;
  const narrow = w < 3 * want;
  const out = { left: narrow ? Math.max(0, Math.min(want, r.left - leftEnd)) : 0, right: narrow ? Math.max(0, Math.min(want, rightEnd - r.right)) : 0 };
  const inner = { left: want - out.left, right: want - out.right };
  // the middle that stays free to drag: at least 24 px, or the whole clip when it is tiny
  const spare = Math.max(0, w - Math.min(w, Math.max(24, w - 2 * want)));
  if (inner.left + inner.right > spare) {
    const k = spare / (inner.left + inner.right);
    inner.left *= k;
    inner.right *= k;
  }
  for (const side of ['left', 'right']) {
    const edge = clip.querySelector(`.st-edge.${side}`);
    if (!edge) continue;
    const size = out[side] + inner[side];
    edge.hidden = size < 8;
    edge.style.width = `${size}px`;
    edge.style[side] = `${-2 - out[side]}px`;
    // the bar you see (16 px) sits on the clip's edge: outside it when there is room
    const bar = Math.min(16, size);
    const barOut = Math.min(out[side], bar);
    edge.style.setProperty('--bar', `${side === 'left' ? out[side] - barOut : inner[side] - (bar - barOut)}px`);
    edge.style.setProperty('--barw', `${bar}px`);
  }
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
  // waiting for sounds to be made: the kid sees why it is quiet, and can still stop
  const ready = S.busy === 'play' && S.waiting === 'play' ? SAY.readyPlay : S.busy === 'mic' && S.waiting === 'rec' ? SAY.readyRec : '';
  const recWait = S.busy === 'mic' && S.waiting === 'rec';
  const recLabel = recWait ? '■ Stop' : S.busy === 'mic' ? 'Getting ready…' : S.busy === 'save' ? 'Saving…' : rec ? '■ Stop recording' : '● Record';
  return `
    <div class="st-bar">
      <div class="st-main">
        <button class="btn st-play ${playing ? 'playing' : ''}" data-action="st-play" ${rec || held ? 'disabled' : ''}>${steady(playing ? '■ Stop' : '▶ Play', '▶ Play', '■ Stop')}</button>
        <button class="btn st-rec ${rec ? 'recording' : ''}" data-action="st-rec" ${held && !recWait ? 'disabled' : ''}>${steady(recLabel, '■ Stop recording', 'Getting ready…', 'st-rec-label')}</button>
      </div>
      <div class="st-undos">
        <button class="btn ghost st-undo ${S.undo.length ? '' : 'off'}" data-action="st-undo" ${S.undo.length ? '' : 'aria-disabled="true"'}>↩ Undo</button>
        <button class="btn ghost st-redo ${S.redo.length ? '' : 'off'}" data-action="st-redo" ${S.redo.length ? '' : 'aria-disabled="true"'}>↪ Redo</button>
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
      ${ready ? `<p class="st-ready" role="status"><span aria-hidden="true">⏳</span> ${esc(ready)}</p>` : ''}
    </div>`;
}

/**
 * A button's words that never change its width: the longest words it can show (a and b) sit
 * invisibly in the same place, so the buttons after it don't slide under a finger.
 */
function steady(text, a, b, cls = '') {
  return `<span class="st-steady" data-a="${esc(a)}" data-b="${esc(b)}"><span class="${cls}">${esc(text)}</span></span>`;
}

function noteHtml() {
  return `<p class="st-note ${S.noteKind}" role="status"><span>${esc(S.note)}</span><button class="btn ghost small-btn" data-action="st-note-close">OK</button></p>`;
}

/**
 * A clip's words (not a take's): { icon, name, song (where it comes from), key, fits (goes
 * with the mix's key), voice and kit (the ones the kid gave it, or null), moved (how many
 * octaves higher, or lower when negative) }.
 */
function clipWords(c, mix = S.mix) {
  const voice = c.voice && VOICES[c.voice] ? VOICES[c.voice] : null;
  const kit = c.kit && KITS[c.kit] ? KITS[c.kit] : null;
  const moved = splitShift(c.shift || 0).octaves;
  if (c.kind === 'notes') {
    const n = NOTES_WORDS[c.role] || NOTES_WORDS.tune;
    const key = clipKey(c);
    return { ...n, key: key ? keyLabel(key) : '', fits: clipFits(mix, c), voice, kit, moved };
  }
  if (c.kind === 'backing') {
    const b = BACKING[c.pattern];
    const notes = b?.kind === 'notes';
    const loop = LOOPS[c.loop] || LOOPS.sunny;
    return {
      icon: GROUP_ICONS[b?.group] || '🎶', name: b?.name || 'Backing track', song: notes ? `${loop.name} chords` : 'Backing track',
      key: notes ? keyLabel(backingKey(mix.key, loop.mood)) : '', fits: true, voice, kit, moved,
    };
  }
  const src = sourceOf(c.song);
  // drums have no key
  const key = clipSound(c) === 'notes' ? clipKey(c) || src?.key : '';
  return { icon: PART_ICONS[c.part] || '🎵', name: PART_NAMES[c.part] || 'Part', song: src?.name || '', key: key ? keyLabel(key) : '', fits: clipFits(mix, c), voice, kit, moved };
}

/** How a clip is played, in words: "Deep bass, 2 octaves lower", "Big kit", or ''. */
function howWords(w) {
  const bits = [];
  if (w.voice) bits.push(`${w.voice.icon} ${w.voice.name}`);
  if (w.kit) bits.push(`${w.kit.icon} ${w.kit.name}`);
  if (w.moved) bits.push(`${octavesWord(Math.abs(w.moved))} ${w.moved > 0 ? 'higher' : 'lower'}`);
  return bits.join(', ');
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
    return `<div class="st-lane ${trackVolume(mix, t) === 0 ? 'muted' : ''}" data-track="${t}" aria-label="Track ${t + 1}">${body}${mark}${recBox}</div>`;
  }).join('');
  // each track's loudness button: its number and a speaker that shows how loud it is
  const names = mix.tracks.map((_, t) => {
    const v = trackVolume(mix, t);
    return `<button class="st-vol lvl-${v} ${S.volTrack === t ? 'on' : ''}" data-action="st-vol" data-track="${t}" aria-expanded="${S.volTrack === t}" aria-label="${esc(`Track ${t + 1}: ${volumeWords(v)}. Tap to change how loud it is.`)}"><b>${t + 1}</b><i aria-hidden="true">${volumeIcon(v)}</i></button>`;
  }).join('');
  const label = hasClips(mix)
    ? `${esc(mix.name)}${mix.key ? ` · ${esc(keyLabel(mix.key))}` : ''} · ${mix.meter} beats in a bar`
    : 'Your mix is empty. Tap a part below to start!';
  return `
    <section class="st-desk" aria-label="Your mix">
      <p class="st-mixname">${label}</p>
      <div class="st-time">
        <div class="st-names"><span aria-hidden="true"></span>${names}</div>
        <div class="st-lanes" style="--beats:${beats};--bars:${mix.bars}">
          <div class="st-ruler">${ruler}</div>
          ${lanes}
          <div class="st-head" hidden></div>
        </div>
      </div>
      ${S.volTrack != null && S.volTrack < TRACKS ? volumeHtml(S.volTrack) : ''}
    </section>`;
}

/** A speaker that shows a track's level: crossed out when muted. */
const volumeIcon = (v) => (v === 0 ? '🔇' : v <= 1 ? '🔈' : v <= USUAL_VOLUME ? '🔉' : '🔊');

/** A track's level in words. */
const volumeWords = (v) => (v === 0 ? 'muted' : `loudness ${v} of ${VOLUME_TOP}`);

/** The loudness panel of a track: Quieter, Louder, five dots for the level, Mute or Unmute. */
function volumeHtml(t) {
  const v = trackVolume(S.mix, t);
  const dots = Array.from({ length: VOLUME_TOP }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
  return `
    <div class="st-volpanel" role="group" aria-label="How loud track ${t + 1} is">
      <p class="st-vol-what"><b>Track ${t + 1}</b><small>${v === 0 ? 'Muted: you can\'t hear it.' : v === USUAL_VOLUME ? 'Usual loudness' : v < USUAL_VOLUME ? 'Quieter than usual' : 'Louder than usual'}</small></p>
      <div class="st-vol-buttons">
        <button class="btn ghost small-btn" data-action="st-vol-step" data-d="-1">🔉 Quieter</button>
        <span class="st-dots ${v === 0 ? 'off' : ''}" role="img" aria-label="${esc(volumeWords(v))}">${dots}</span>
        <button class="btn ghost small-btn" data-action="st-vol-step" data-d="1">🔊 Louder</button>
        <button class="btn ghost small-btn ${v === 0 ? 'on' : ''}" data-action="st-vol-mute" aria-pressed="${v === 0}">${v === 0 ? '🔈 Unmute' : '🔇 Mute'}</button>
        <button class="btn ghost small-btn" data-action="st-vol" data-track="${t}" aria-label="Done">✓ Done</button>
      </div>
    </div>`;
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
  const w = clipWords(c);
  const kind = c.kind === 'backing' ? `kind-backing group-${esc(BACKING[c.pattern]?.group || '')}` : c.kind === 'notes' ? `kind-notes role-${esc(c.role)}` : `kind-${esc(c.part)}`;
  // a voice or kit of the kid's choosing shows as its icon
  const mark = remixed(c) ? `<i class="st-vicon" aria-hidden="true">${(w.voice || w.kit).icon}</i>` : '';
  const how = howWords(w);
  const key = w.key ? `<small class="st-key ${w.fits ? '' : 'no'}">${esc(w.key)}${w.fits ? '' : ' · another key'}</small>` : '';
  return `<div class="st-clip ${kind} ${sel ? 'sel' : ''}" data-id="${c.id}" ${c.voice ? `data-voice="${esc(c.voice)}"` : ''} ${c.kit ? `data-kit="${esc(c.kit)}"` : ''} ${c.shift ? `data-shift="${c.shift}"` : ''} style="${style}" title="${esc([w.name, w.song, w.key, how].filter(Boolean).join(', '))}">
    <b>${mark}${w.icon} ${esc(w.name)}</b><small>${esc(w.song)}</small>${key}${edges}</div>`;
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
  if (S.nom) return nomHtml();
  const found = S.sel != null && findClip(S.mix, S.sel);
  if (!found) return `<p class="st-hint muted">${esc(spotHint())} Tap an empty place on a track to choose another spot. Tap a clip to change it.</p>`;
  const { clip: c } = found;
  let words = '🎤 My take';
  let how = '';
  if (c.kind !== 'take') {
    const w = clipWords(c);
    words = c.kind === 'backing'
      ? `${w.icon} ${w.name}, a backing track${w.key ? `: ${w.song}, in ${w.key}` : ''}`
      : c.kind === 'notes' ? `${w.icon} ${w.name}${w.key ? `, in ${w.key}` : ''}`
        : `${w.icon} ${w.name} from ${w.song}${w.key ? `, in ${w.key}` : ''}`;
    how = howWords(w);
  }
  const b = (todo, label, aria) => `<button class="btn ghost small-btn" data-action="st-nudge" data-do="${todo}" aria-label="${aria}">${label}</button>`;
  return `
    <div class="st-tools" role="toolbar" aria-label="Change this clip">
      <p class="st-what"><b>${esc(words)}</b><small>Track ${found.track + 1}, beats ${c.start + 1} to ${c.start + c.len}${how ? ` · ${esc(how)}` : ''}</small></p>
      <div class="st-tool-buttons">
        ${b('earlier', '◀ Earlier', 'Start earlier')}${b('later', 'Later ▶', 'Start later')}
        ${b('up', '▲ Up', 'Up a track')}${b('down', '▼ Down', 'Down a track')}
        ${b('shorter', '✂ Shorter', 'One beat shorter')}${b('longer', '↔ Longer', 'One beat longer')}
        <button class="btn ghost small-btn" data-action="st-copy">⧉ Copy</button>
        <button class="btn ghost small-btn danger-text" data-action="st-delete">🗑 Delete</button>
        <button class="btn ghost small-btn" data-action="st-unselect" aria-label="Done">✓ Done</button>
      </div>
      ${c.kind === 'take' ? notesButtonHtml(c) : remixHtml(c)}
    </div>`;
}

/** A take's button for the Note-o-Matic (a take whose sound is missing can't be turned). */
function notesButtonHtml(c) {
  const gone = S.takes.has(c.take) && !S.takes.get(c.take);
  return `<div class="st-tool-buttons st-remix"><button class="btn small-btn st-nom-btn" data-action="st-nom" ${gone ? `aria-disabled="true" title="${esc(SAY.nomMissing)}"` : ''}>🎹 Turn it into notes</button></div>`;
}

/**
 * The Note-o-Matic's panel, in place of the tools: listening (with how far it got and Stop),
 * nothing heard, or the three readings to hear and pick from, with Use it and Keep my recording.
 */
function nomHtml() {
  const nom = S.nom;
  const head = '<div class="st-panel-head"><h3>🎹 Turn it into notes</h3></div>';
  let body;
  if (nom.phase === 'listen') {
    const p = Math.round(nom.progress * 100);
    body = `<p class="st-nom-status" role="status"><b>${esc(SAY.nomListening)}</b></p>
      <div class="st-progress" role="progressbar" aria-label="How far I got" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><i style="width:${p}%"></i></div>
      <div class="st-nom-buttons"><button class="btn ghost small-btn" data-action="st-nom-close">■ Stop</button></div>`;
  } else if (nom.phase === 'nothing' || nom.phase === 'broken') {
    body = `<p class="st-note ${nom.phase === 'broken' ? 'bad' : ''} st-nom-nothing" role="status"><span>${esc(nom.phase === 'broken' ? SAY.nomBroken : SAY.nomNothing)}</span></p>
      <div class="st-nom-buttons"><button class="btn small-btn" data-action="st-nom-close">OK</button></div>`;
  } else {
    const res = nom.result;
    const cards = READINGS.map((r) => {
      const has = Boolean(res[r.id]);
      const on = has && nom.pick === r.id;
      const key = `nom|${r.id}`;
      const hearing = S.hearing === key;
      const face = !hearing ? '▶ Listen' : S.hearWait === key ? '⏳ Getting ready' : '■ Stop';
      return `<div class="st-reading ${on ? 'on' : ''} ${has ? '' : 'off'}" data-reading="${r.id}">
        <button class="st-reading-pick" data-action="st-nom-pick" data-reading="${r.id}" role="radio" aria-checked="${on}" ${has ? '' : 'aria-disabled="true"'}>
          <b>${esc(r.name)}</b><small>${esc(has ? r.about : SAY.nomNoBand)}</small></button>
        <button class="btn ghost small-btn st-nom-hear ${hearing ? 'on' : ''}" data-action="st-nom-hear" data-reading="${r.id}" ${has ? '' : 'aria-disabled="true" disabled'}>${steady(face, '⏳ Getting ready', '▶ Listen')}</button>
      </div>`;
    }).join('');
    const said = [res.key ? `Sounds like it is in ${keyLabel(res.key)}.` : '', res.onBeat ? '' : SAY.nomOwnSpeed].filter(Boolean).join(' ');
    body = `<p class="muted small">Listen to each one, then pick the one you like.</p>
      <div class="st-readings" role="radiogroup" aria-label="How your notes can be written">${cards}</div>
      ${said ? `<p class="st-nom-key">${esc(said)}</p>` : ''}
      <div class="st-nom-buttons"><button class="btn small-btn st-nom-use" data-action="st-nom-use">✓ Use it</button><button class="btn ghost small-btn" data-action="st-nom-close">Keep my recording</button></div>`;
  }
  return `<section class="st-panel st-nom" aria-label="Turn your take into notes">${head}${body}</section>`;
}

/**
 * The remix buttons for a picked clip: a voice, higher, lower and moving into the mix's key
 * for music with notes; a kit for drums. With the chooser of voices or kits when it is open.
 */
function remixHtml(c) {
  const sound = clipSound(c);
  if (!sound) return '';
  const open = S.chooser?.id === c.id ? S.chooser.what : '';
  const toggle = (what, label) => `<button class="btn ghost small-btn st-remix-btn ${open === what ? 'on' : ''}" data-action="st-chooser" data-what="${what}" aria-expanded="${open === what}">${label}</button>`;
  let buttons;
  let chooser = '';
  if (sound === 'notes') {
    const fit = !clipFits(S.mix, c) ? `<button class="btn small-btn st-movekey" data-action="st-fit">🎯 Move into ${esc(keyLabel(S.mix.key))}</button>` : '';
    buttons = `${toggle('voice', '🎨 Voice')}
      <button class="btn ghost small-btn" data-action="st-shift" data-d="12" aria-label="An octave higher">⬆ Higher</button>
      <button class="btn ghost small-btn" data-action="st-shift" data-d="-12" aria-label="An octave lower">⬇ Lower</button>${fit}`;
    if (open === 'voice') {
      const own = !c.voice;
      const choices = Object.entries(VOICES).map(([id, v]) => {
        const on = c.voice === id;
        return `<button class="btn ghost small-btn st-choice ${on ? 'on' : ''}" data-action="st-voice" data-voice="${id}" aria-pressed="${on}"><i aria-hidden="true">${v.icon}</i>${esc(v.name)}</button>`;
      }).join('');
      chooser = `<div class="st-chooser" role="group" aria-label="Voices">
        <button class="btn ghost small-btn st-choice ${own ? 'on' : ''}" data-action="st-voice" data-voice="" aria-pressed="${own}"><i aria-hidden="true">${c.kind === 'backing' ? VOICES[BACKING[c.pattern].voice]?.icon || '🎵' : c.kind === 'notes' ? VOICES[NOTES_VOICE].icon : '🎵'}</i>Its own sound</button>${choices}</div>`;
    }
  } else {
    buttons = toggle('kit', '🥁 Kit');
    if (open === 'kit') {
      const choices = Object.entries(KITS).map(([id, k]) => {
        const on = (c.kit || 'chip') === id;
        return `<button class="btn ghost small-btn st-choice ${on ? 'on' : ''}" data-action="st-kit" data-kit="${id}" aria-pressed="${on}"><i aria-hidden="true">${k.icon}</i>${esc(k.name)}</button>`;
      }).join('');
      chooser = `<div class="st-chooser" role="group" aria-label="Drum kits">${choices}</div>`;
    }
  }
  // what a button did shows under the choices (a toast would cover them on a phone)
  const making = S.hearing.startsWith('clip|') && S.hearWait === S.hearing;
  const said = open && (S.said || making)
    ? `<p class="st-said" role="status">${S.said ? `<span>${esc(S.said)}</span>` : ''}${making ? `<span class="st-making"><i aria-hidden="true">⏳</i> ${esc(SAY.readyClip)}</span>` : ''}</p>`
    : '';
  return `<div class="st-tool-buttons st-remix">${buttons}</div>${chooser}${said}`;
}

/** A 🔊 button's face: ⏳ while its sound is being made, ■ while it plays (a tap stops it either way). */
function hearFace(key, name) {
  if (S.hearing !== key) return { face: '🔊', label: `Hear the ${name}`, on: false };
  return S.hearWait === key ? { face: '⏳', label: 'Getting it ready. Tap to stop.', on: true } : { face: '■', label: 'Stop', on: true };
}

function stickersHtml() {
  if (!S.badges.length) return '<section class="st-stickers empty"><p class="muted">Stickers you earn with this mix show up here. Try recording yourself, or mixing two songs!</p></section>';
  return `<section class="st-stickers" aria-label="Stickers">${S.badges.map((b) => `
    <div class="st-sticker ${S.pop === b.id ? 'pop' : ''}" data-sticker="${esc(b.id)}"><i aria-hidden="true">${STICKER_ICONS[b.id] || '⭐'}</i><b>${esc(b.name)}</b><small>${esc(b.why)}</small></div>`).join('')}</section>`;
}

function shelfHtml() {
  const mix = S.mix;
  const songs = deskOf(S.kid)?.songs() || [];
  const cards = songs.map((p) => {
    const src = sourceOf(p.id);
    let parts = [];
    try { parts = songParts(p.id); } catch { parts = ['lead']; }
    const fits = mix.key && hasClips(mix) ? keyFits(mix.key, src.key) : null;
    const beatNote = src.meter === 3 ? '<small class="st-waltz">3 beats in a bar</small>' : '';
    const fit = fits === true ? '<small class="st-fit">✓ Goes with your mix</small>' : fits === false ? '<small class="st-fit no">Another key</small>' : '';
    const buttons = parts.map((part) => {
      const h = hearFace(`${p.id}|${part}`, PART_NAMES[part]);
      return `<span class="st-part"><button class="btn small-btn st-add kind-${part}" data-action="st-add" data-song="${esc(p.id)}" data-part="${part}">${PART_ICONS[part]} ${PART_NAMES[part]}</button><button class="btn ghost small-btn st-hear ${h.on ? 'on' : ''}" data-action="st-hear" data-song="${esc(p.id)}" data-part="${part}" aria-label="${esc(h.label)}">${h.face}</button></span>`;
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
    </section>${backingHtml()}`;
}

/** The key the backing tracks play in on this desk: the mix's (none while the desk is empty). */
const backingMixKey = () => (hasClips(S.mix) ? S.mix.key : null);

/**
 * The backing tracks: a picker for the chords (the chosen one says the key it plays in), and
 * the beats, cymbals, bass lines, chords and sparkles of the mix's beat. While the desk is
 * empty there are both: the four-beat ones, then the waltz ones apart under their own heading
 * (the first one picked sets the mix's beat).
 */
function backingHtml() {
  const mix = S.mix;
  const empty = !hasClips(mix);
  const key = backingMixKey();
  const loops = LOOP_IDS.map((id) => {
    const l = LOOPS[id];
    const on = id === S.loop;
    return `<button class="btn ghost small-btn st-loop ${on ? 'on' : ''}" data-action="st-loop" data-loop="${id}" aria-pressed="${on}">${on ? `${esc(l.name)}, in ${esc(keyLabel(backingKey(key, l.mood)))}` : esc(l.name)}</button>`;
  }).join('');
  const groups = (meter) => Object.entries(BACKING_GROUPS).map(([group, title]) => {
    const items = Object.entries(BACKING).filter(([, b]) => b.group === group && b.meter === meter);
    if (!items.length) return '';
    const buttons = items.map(([id, b]) => {
      const h = hearFace(`backing|${id}`, b.name);
      const waltz = b.meter === 3 ? '<small class="st-waltz">3 beats</small>' : '';
      return `<span class="st-part"><button class="btn small-btn st-add group-${group}" data-action="st-back-add" data-pattern="${id}"><span>${GROUP_ICONS[group]} ${esc(b.name)}</span>${waltz}</button><button class="btn ghost small-btn st-hear ${h.on ? 'on' : ''}" data-action="st-back-hear" data-pattern="${id}" aria-label="${esc(h.label)}">${h.face}</button></span>`;
    }).join('');
    return `<div class="st-group" data-group="${group}"><p class="st-group-name"><b>${esc(title)}</b></p><div class="st-parts">${buttons}</div></div>`;
  }).join('');
  const list = empty
    ? `<div class="st-songs" data-meter="4">${groups(4)}</div>
      <div class="st-waltz-time" data-meter="3">
        <h4>Waltz time: 3 beats in a bar</h4>
        <p class="muted small">These are for a waltz. Pick one, and your mix has 3 beats in a bar.</p>
        <div class="st-songs">${groups(3)}</div>
      </div>`
    : `<div class="st-songs" data-meter="${mix.meter}">${groups(mix.meter)}</div>`;
  return `
    <section class="st-shelf st-backing" aria-label="Backing tracks">
      <h3>Backing tracks</h3>
      <p class="muted small">Beats, cymbals, bass lines and chords that go with any song. Pick the chords first: the bass lines, chords and sparkles play them in the key of your mix.</p>
      <div class="st-loops" role="group" aria-label="Chords">${loops}</div>
      ${list}
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
        <li>Backing tracks are beats, bass lines and chords that go with any song. They play in the key of your mix.</li>
        <li>Tap a clip with notes to give it a new voice, or to move it higher or lower. Tap drums to play them on another drum kit.</li>
        <li>Tap the speaker beside a track's number to make that track quieter or louder, or to mute it.</li>
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
 * The desk gets a new mix: Undo remembers the one before (`undo`), stickers, the draft saved,
 * and the music carries on from the same place. `back` is a step of Undo or Redo: no sticker
 * news. `quiet`: the caller tells the kid about a new sticker itself. Returns the new sticker.
 */
function commit(mix, { select, undo = true, back = false, quiet = false } = {}) {
  const had = new Set(S.badges.map((b) => b.id));
  if (undo) rememberUndo();
  const sameMusic = musicOf(S.mix) === musicOf(mix);
  S.mix = mix;
  if (back) syncLoop();
  if (select !== undefined) S.sel = select;
  if (S.sel != null && !findClip(mix, S.sel)) S.sel = null;
  if (S.spot.beat >= mixBeats(mix)) S.spot = { track: S.spot.track, beat: 0, picked: false };
  S.badges = badges(mix);
  const fresh = back ? null : S.badges.find((b) => !had.has(b.id)) || null;
  S.pop = fresh?.id || '';
  if (fresh && !quiet) setTimeout(() => toast(stickerNews(fresh)), 50);
  autosave();
  forgetTakes();
  if (A.play && sameMusic) {
    // only a track's loudness changed: the music plays on, a little louder or quieter
    A.play.mix = mix;
    setLanes(mix);
  } else if (A.play || S.busy === 'play') restartPlay();
  paint();
  return fresh;
}

const stickerNews = (b) => `🏅 New sticker: ${b.name}! ${b.why}`;

/**
 * After a remix button: the new mix on the desk and what happened (with a new sticker), or why
 * not. With the chooser open it says so under the choices, where a toast can't cover them;
 * `toast` says it in a toast anyway (for a button far from the chooser).
 */
function remixDone(r, said, { toast: inToast = false } = {}) {
  const here = !inToast && S.chooser && S.chooser.id === S.sel;
  const tell = (text) => { if (here) { S.said = text; paint(); } else toast(text); };
  if (r.error) { tell(r.error); return; }
  const fresh = commit(r.mix, { quiet: true });
  tell(`${said}${fresh ? ` ${stickerNews(fresh)}` : ''}`);
}

/** Undo can go back to the desk's mix as it is now. A new change ends what Redo could bring back. */
function rememberUndo() {
  S.redo = [];
  if (S.undo[S.undo.length - 1] === S.mix) return;
  S.undo.push(S.mix);
  if (S.undo.length > MOST_UNDO) S.undo.shift();
}

/** Takes in mix a that aren't in mix b. */
const takesGone = (a, b) => { const kept = new Set(takeIds(b)); return takeIds(a).some((id) => !kept.has(id)); };

/** Step back to the mix before the last change (Redo brings it back). */
function undo() {
  const before = S.undo.pop();
  if (!before) { toast(SAY.nothingToUndo); return; }
  const now = S.mix;
  S.redo.push(now);
  if (S.redo.length > MOST_UNDO) S.redo.shift();
  commit(before, { undo: false, back: true });
  loadTakes(before);
  toast(takesGone(now, before) ? SAY.undoneTake : SAY.undone);
}

/** Bring back what Undo took back. */
function redo() {
  const next = S.redo.pop();
  if (!next) { toast(SAY.nothingToRedo); return; }
  const now = S.mix;
  S.undo.push(now);
  if (S.undo.length > MOST_UNDO) S.undo.shift();
  commit(next, { undo: false, back: true });
  loadTakes(next);
  toast(takesGone(next, now) ? SAY.redoneTake : SAY.redone);
}

/** Keep the desk's mix as the draft, a moment after the last change. */
function autosave() {
  pending = { kid: S.kid, mix: S.mix };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 500);
}

/**
 * Save the draft now, if it is waiting. Resolves true when it is kept (or nothing waited),
 * false when it couldn't be: then the kid hears about it once a visit, unless `quiet` (the
 * caller says so itself).
 */
function flushSave(quiet = false) {
  clearTimeout(saveTimer);
  const p = pending;
  pending = null;
  if (!p || S.broken) return Promise.resolve(true);
  return saveMix(p.kid, 'draft', p.mix).then(() => true, () => {
    if (!quiet && !S.saveWarned) { S.saveWarned = true; toast(SAY.draftFailed); }
    return false;
  });
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
    // four tracks at once stay safe: 0.4 of full volume, and the loudest bits bent over softly.
    // Four tracks play together, and quiet sounds (plucked voices, drums) are lifted up to 1.6
    // times (music.js levelGain), so a whole mix must stay under the soft clip's ceiling; the
    // tracks' own levels only balance them (studiorules.js trackGain), never add to it.
    // The bending adds no delay, so the music stays in time with the clicks.
    const net = A.ac.createWaveShaper();
    net.curve = softClip();
    net.oversample = 'none';
    A.master = A.ac.createGain();
    A.master.gain.value = 0.4;
    A.master.connect(net).connect(A.ac.destination);
  } catch {
    A.ac = null;
    return null;
  }
  return A.ac;
}

/** How late the speaker is: what plays at context time t is heard at t + this. */
const outLag = () => (A.ac ? A.ac.outputLatency || A.ac.baseLatency || 0 : 0);

/**
 * What a ready-made clip sounds like, in a mix in key `mixKey`: { kind, song, part, pattern,
 * loop, tonic (the key note a backing track's chords are on), voice, kit, shift }. Two clips
 * with the same sound share one rendering.
 */
function soundOf(c, mixKey, swing = 0) {
  const how = { voice: c.voice || '', kit: c.kit || '', shift: c.shift || 0 };
  if (c.kind === 'part') return { kind: 'part', song: c.song, part: c.part, ...how };
  // the kid's notes: their name (nid) says which notes, so copies share one rendering
  if (c.kind === 'notes') return { kind: 'notes', nid: c.nid, notes: c.notes, beats: c.total, swing, ...how };
  const notes = clipSound(c) === 'notes';
  const loop = notes ? (LOOPS[c.loop] ? c.loop : 'sunny') : '';
  // a backing track swings with the mix's song parts (studiorules.js backingSwing)
  return { kind: 'backing', pattern: c.pattern, loop, tonic: notes ? keyTonic(backingKey(mixKey, LOOPS[loop].mood)) : '', swing, ...how };
}

/** A clip's sound in a mix (a backing track, and the kid's notes on straight eighths, swing with it). */
const mixSound = (c, mix) => soundOf(c, mix.key, clipSwing(mix, c));

/** Where a sound at a speed is kept among the rendered ones. */
const soundKey = (s, bpm) => [s.kind, s.song || s.pattern || s.nid, s.part || '', bpm, s.voice, s.kit, s.shift, s.loop || '', s.tonic ?? '', s.swing || 0, s.kind === 'notes' ? `${s.beats}:${s.notes.length}` : ''].join('|');

/** The sounds a mix plays (soundKey), worked out once a mix. */
const keysMade = new WeakMap();
function mixKeys(mix) {
  if (!keysMade.has(mix)) keysMade.set(mix, new Set(mix.tracks.flat().filter((c) => c.kind !== 'take').map((c) => soundKey(mixSound(c, mix), mix.bpm))));
  return keysMade.get(mix);
}

/**
 * Whether a sound is still wanted: the desk's mix or the one playing uses it, or it is being
 * heard. A voice, kit, shift, chords or speed changed again, or a clip thrown away, and the
 * sound being made for it isn't.
 */
function wanted(key) {
  if (!S.on) return false;
  return A.hearKey === key || mixKeys(S.mix).has(key) || Boolean(A.play && mixKeys(A.play.mix).has(key));
}

/**
 * Render a ready-made clip's sound once through. A song's part in its own sound, not moved,
 * is the song itself (music.js renderPart); anything else is played from its notes.
 */
function renderSound(s, bpm, rate, alive = null) {
  if (s.kind === 'notes') {
    return renderEvents(s.notes, { bpm, steps: s.beats * 2, swing: s.swing || 0, sampleRate: rate, alive, voice: s.voice || NOTES_VOICE, shift: s.shift });
  }
  if (s.kind === 'part') {
    if (!s.voice && !s.kit && !s.shift) return renderPart(s.song, s.part, bpm, rate, 0.5, alive);
    const style = partStyle(s.song, s.part);
    const events = partEvents(s.song, s.part);
    const common = { bpm, steps: style.steps, swing: style.swing, sampleRate: rate, alive };
    if (clipSound(s) === 'drums') return renderEvents(events, { ...common, kit: s.kit || null, vol: style.drumVol });
    // its own sound keeps the song's echo; a new voice plays without it
    return renderEvents(events, { ...common, voice: s.voice || style.voice, shift: s.shift, echo: s.voice ? 0 : style.echo });
  }
  const b = BACKING[s.pattern];
  const steps = backingBeats(s.pattern) * 2;
  const common = { bpm, steps, swing: s.swing || 0, sampleRate: rate, alive };
  if (b.kind === 'drums') return renderEvents(backingEvents(s.pattern), { ...common, kit: s.kit || null });
  return renderEvents(backingEvents(s.pattern, { loop: s.loop, tonic: s.tonic }), { ...common, voice: s.voice || b.voice, shift: s.shift });
}

/**
 * A clip's sound at a speed, rendered once and kept (null when it can't be made). A sound that
 * stops being wanted while it is made is given up half way (music.js renderInSlices): that
 * one is never kept or played. Wanted again by then, it is made again from the start.
 */
function soundBuffer(s, bpm) {
  const key = soundKey(s, bpm);
  let made = A.parts.get(key);
  if (made) A.parts.delete(key);
  else {
    let dropped = false;
    const alive = () => { if (!dropped && !wanted(key)) dropped = true; return !dropped; };
    const job = Promise.resolve().then(() => renderSound(s, bpm, A.ac.sampleRate, alive)).catch(() => null).then((buf) => {
      if (buf && !dropped) { job.ready = true; return buf; }
      if (A.parts.get(key) === job) A.parts.delete(key); // a broken or half-made sound is never kept
      return dropped && wanted(key) ? soundBuffer(s, bpm) : null;
    });
    made = job;
  }
  A.parts.set(key, made); // the last used goes to the end
  trimParts();
  return made;
}

/** Whether a sound is made already, so using it needs no wait. */
const soundReady = (s, bpm) => A.parts.get(soundKey(s, bpm))?.ready === true;

/** Whether some clip of a mix still has to have its sound made (then the kid is told to wait). */
const mixWaits = (mix) => mix.tracks.flat().some((c) => c.kind !== 'take' && !soundReady(mixSound(c, mix), mix.bpm));

/** Keep only a few rendered sounds: forget the ones used longest ago, but never the mix's. */
function trimParts() {
  const used = new Set([S.mix, A.play?.mix].filter(Boolean).flatMap((m) => [...mixKeys(m)]));
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

/**
 * Every clip's sound for a mix: Map clip id -> AudioBuffer. Missing ones are left out, kindly.
 * Nothing is said when the wait was given up meanwhile (`token`, see A.token).
 */
async function buffersFor(mix, token = A.token) {
  const plan = schedule(mix);
  const got = await Promise.all(plan.map((e) => (e.kind === 'take' ? takeBuffer(e.take) : soundBuffer(mixSound(findClip(mix, e.id).clip, mix), mix.bpm))));
  const out = new Map();
  if (token !== A.token) return out;
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
function newBus(mix = null) {
  const g = A.ac.createGain();
  g.connect(A.master);
  A.bus = g;
  A.lanes = null;
  // a mix's tracks each get their own loudness between their clips and the knob
  if (mix) {
    A.lanes = Array.from({ length: TRACKS }, (_, t) => {
      const lane = A.ac.createGain();
      lane.gain.value = trackGain(mix, t);
      lane.connect(g);
      return lane;
    });
  }
  return g;
}

/** Each track's loudness as `mix` has it, while it plays: a short smooth slide, no click. */
function setLanes(mix) {
  if (!A.lanes) return;
  const t = A.ac.currentTime;
  A.lanes.forEach((lane, i) => {
    const p = lane.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(trackGain(mix, i), t + 0.04);
  });
}

/**
 * Start a sound at `when` (context time), `offset` seconds in, for `dur`, with 5 ms fades.
 * `sharp`: the very start of a part, where a drum or a note begins, isn't faded in.
 */
function startSource(buffer, when, offset, dur, { sharp = false, track = null } = {}) {
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
  src.connect(g).connect((track != null && A.lanes?.[track]) || A.bus || newBus());
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
  const lanes = A.lanes || [];
  A.bus = null; // the next sound gets a new knob, so this fade never touches it
  A.lanes = null;
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
    for (const lane of lanes) { try { lane.disconnect(); } catch { /* gone */ } }
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
  const mix = S.mix;
  S.busy = 'play';
  S.waiting = mixWaits(mix) ? 'play' : '';
  paint();
  try { await ac.resume(); } catch { /* it starts on the next tap */ }
  const bufs = await buffersFor(mix, token);
  if (token !== A.token || !onScreen()) {
    // a stop already tidied up; if nothing did (the studio went away), do it here
    if (token === A.token && S.busy === 'play') S.busy = '';
    return;
  }
  S.busy = '';
  S.waiting = '';
  const beat = 60 / mix.bpm;
  const beats = mixBeats(mix);
  const first = (((fromBeat % beats) + beats) % beats) * beat;
  newBus(mix);
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
    // a take's lead (its sound from before the beat) starts early: on the first time round
    // when there is time, and later at the very end of the loop before
    for (const e of p.k === 0 ? firstPass(p.plan, p.first) : sliceSchedule(p.plan, -Infinity)) {
      const b = p.bufs.get(e.id);
      if (b) startSource(b, base + e.at, e.offset, e.dur, { sharp: e.kind !== 'take' && e.offset === 0, track: e.track });
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
function hear(song, part) {
  const src = sourceOf(song);
  hearSound(`${song}|${part}`, soundOf({ kind: 'part', song, part }, null), { bpm: hasClips(S.mix) ? S.mix.bpm : src.bpm, beats: 4 * src.meter });
}

/** How a backing track swings on this desk: as the mix's song parts (none while the desk is empty). */
const deskSwing = () => (hasClips(S.mix) ? backingSwing(S.mix) : 0);

/** Hear one backing track on the shelf (all four bars, on the chords picked), or stop it. */
function hearBacking(pattern) {
  const b = BACKING[pattern];
  if (!b) return;
  const s = soundOf({ kind: 'backing', pattern, loop: S.loop }, backingMixKey(), deskSwing());
  hearSound(`backing|${pattern}`, s, { bpm: hasClips(S.mix) ? S.mix.bpm : BACKING_BPM, beats: backingBeats(pattern) });
}

/** Hear the first bar of a clip as it plays now (after its voice changed). Not while the mix plays. */
function hearClip(id) {
  const c = findClip(S.mix, id)?.clip;
  if (!c || c.kind === 'take' || A.play || S.busy === 'play') return;
  const s = mixSound(c, S.mix);
  hearSound(`clip|${soundKey(s, S.mix.bpm)}`, s, { bpm: S.mix.bpm, beats: Math.min(S.mix.meter, c.len), from: c.from, again: true });
}

/**
 * Hear a sound (`key` names it, so a second tap stops it) for `beats` beats from beat `from`.
 * `again`: start it over instead of stopping it.
 */
async function hearSound(key, s, { bpm, beats, from = 0, again = false }) {
  if (S.hearing === key && !again) { stopHearing(); return; }
  // not while the microphone gets ready: stopping would quietly cancel the recording
  if (heldNow() || soundOff()) return;
  const ac = audio();
  if (!ac) { say(SAY.noSound, 'bad'); return; }
  stopPlay(false);
  S.hearing = key;
  A.hearKey = soundKey(s, bpm); // (so the sound being made is wanted: see wanted())
  S.hearWait = soundReady(s, bpm) ? '' : key;
  paint();
  try { await ac.resume(); } catch { /* the next tap */ }
  const b = await soundBuffer(s, bpm);
  if (S.hearing !== key) return;
  const waited = S.hearWait === key;
  S.hearWait = '';
  if (!b) { S.hearing = ''; A.hearKey = ''; say(SAY.partBroken); return; }
  if (waited) paint();
  const beat = 60 / bpm;
  const len = Math.min(b.duration - from * beat, beats * beat);
  newBus();
  startSource(b, ac.currentTime + 0.05, from * beat, len, { sharp: true });
  clearTimeout(A.hearTimer);
  A.hearTimer = setTimeout(() => { if (S.hearing === key) stopHearing(); }, len * 1000 + 150);
}

/** Stop the part being heard. */
function stopHearing(draw = true) {
  clearTimeout(A.hearTimer);
  A.hearKey = '';
  S.hearWait = '';
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
  const d = usableDelay(readNumber(DELAY_KEY));
  if (d == null) return guessDelay(A.ac?.outputLatency, A.ac?.baseLatency);
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
  S.waiting = '';
  S.note = '';
  paint();
  const cap = await listen(ac, token);
  if (!cap) return;
  const phones = S.phones;
  // with headphones the mix plays along: its sounds may have to be made first
  if (phones && token === A.token && mixWaits(mix)) { S.waiting = 'rec'; paint(); }
  const bufs = phones ? await buffersFor(mix, token) : null;
  S.waiting = '';
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
    newBus(mix); // (the tracks' loudness too: it changes what is heard, never what is recorded)
    for (const e of sliceSchedule(schedule(mix), spot.beat * beat, (spot.beat + room) * beat)) {
      const b = bufs.get(e.id);
      if (b) startSource(b, origin + e.at, e.offset, e.dur, { track: e.track });
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
    stopAt = stopPoint(heard, r.at, r.end, r.beatSec, TOUCH_LAG);
    if (stopAt == null) { cancelRecording(); if (!hurry) say(SAY.stoppedEarly); return; }
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
    // after the kid left, no Undo step: Undo is for one visit
    const sticker = commit(res.mix, { select: res.id, undo: S.on, quiet: true });
    A.keptAt = performance.now();
    const kept = await flushSave(true);
    if (!kept) say(SAY.takeNotKept, 'bad');
    else if (S.on) toast(`Nice playing! Your take is on track ${r.track + 1}.${sticker ? ` ${stickerNews(sticker)}` : ''}`);
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
  const delay = echoDelay(clicks, heard, { need: clicks.length - 2, most: MOST_DELAY });
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

// ---------- the Note-o-Matic: a take turned into notes ----------

/**
 * The metronome clicks that may be in a take (the studio clicks every beat while recording):
 * [{ at (seconds into the take), hz }]. The take keeps `lead` seconds from before its first
 * beat; its first beat is the clip's untrimmed start, so the bar's first beat clicks higher.
 */
function takeClicks(c, t, mix = S.mix) {
  const beat = 60 / mix.bpm;
  const lead = c.lead || 0;
  const length = t.samples.length / t.rate;
  const first = c.start - c.from;
  const out = [];
  for (let i = 0; lead + i * beat < length; i += 1) {
    out.push({ at: lead + i * beat, hz: (((first + i) % mix.meter) + mix.meter) % mix.meter === 0 ? CLICK.first : CLICK.other });
  }
  return out;
}

/** Open the Note-o-Matic for the picked take: listen to it (once a visit), then offer the readings. */
async function openNom() {
  const found = S.sel != null && findClip(S.mix, S.sel);
  if (!found || found.clip.kind !== 'take' || S.nom) return;
  const c = found.clip;
  if (!S.takes.has(c.take)) {
    let t = null;
    try { t = await loadTake(c.take); } catch { t = null; }
    S.takes.set(c.take, t);
  }
  const t = S.takes.get(c.take);
  if (!t || !t.samples?.length) { toast(SAY.nomMissing); paint(); return; }
  if (S.nom || !findClip(S.mix, c.id)) return; // (a second tap while the take was fetched)
  const nom = { id: c.id, take: c.take, phase: 'listen', progress: 0, result: null, pick: 'tidy', bufs: new Map() };
  S.nom = nom;
  S.chooser = null;
  if (S.heard.has(c.take)) { heardIn(nom, S.heard.get(c.take)); return; }
  paint();
  updateWake();
  listenTo(nom, t.samples, t.rate, takeClicks(c, t));
}

/**
 * Listen to a take's sound in a Worker (listener-worker.js), with how far it got on the panel.
 * A browser that can't run it listens on the screen's own thread instead, after the panel shows.
 */
function listenTo(nom, samples, rate, clicks) {
  const done = (notes, failed = false) => {
    if (S.nom !== nom) return; // stopped meanwhile
    if (failed || !Array.isArray(notes)) { nom.phase = 'broken'; paint(); updateWake(); return; }
    S.heard.set(nom.take, notes);
    heardIn(nom, notes);
  };
  const here = () => {
    stopListening();
    setTimeout(async () => {
      if (S.nom !== nom) return;
      try {
        const { listen: hearNotes } = await import('./listener.js');
        if (S.nom !== nom) return;
        done(hearNotes(samples, rate, { clicks }));
      } catch { done(null, true); }
    }, 60);
  };
  let w;
  try { w = new Worker(new URL('./listener-worker.js', import.meta.url), { type: 'module' }); } catch { here(); return; }
  N.worker = w;
  let answered = false;
  w.onmessage = (e) => {
    if (N.worker !== w) return;
    answered = true;
    const d = e.data || {};
    if (d.progress != null && !('notes' in d) && !('error' in d)) { nom.progress = d.progress; showProgress(nom); return; }
    stopListening();
    done(d.notes, Boolean(d.error));
  };
  w.onerror = (e) => {
    if (N.worker !== w) return;
    e?.preventDefault?.();
    if (!answered) here(); // (an old browser that can't run a module Worker)
    else { stopListening(); done(null, true); }
  };
  const copy = samples.slice(); // the take keeps its own sound
  try { w.postMessage({ samples: copy, rate, clicks }, [copy.buffer]); } catch { here(); }
}

/** Stop the Worker that is listening, if one is. */
function stopListening() {
  const w = N.worker;
  N.worker = null;
  try { w?.terminate(); } catch { /* gone */ }
}

/** How far the listening got: the bar moves without drawing the whole desk again. */
function showProgress(nom) {
  const bar = document.querySelector('#studio .st-nom .st-progress');
  if (!bar) return;
  const p = Math.round(nom.progress * 100);
  bar.setAttribute('aria-valuenow', String(p));
  bar.querySelector('i').style.width = `${p}%`;
}

/** What was heard in the take: the three readings, or "no notes" when fewer than 3 were heard. */
function heardIn(nom, notes) {
  const c = findClip(S.mix, nom.id)?.clip;
  if (notes.length < 3 || !c) nom.phase = 'nothing';
  else {
    const mix = S.mix;
    nom.result = readings(notes, { bpm: mix.bpm, meter: mix.meter, lead: c.lead || 0, beats: c.total, swing: backingSwing(mix), barAt: (((c.start - c.from) % mix.meter) + mix.meter) % mix.meter });
    nom.phase = 'pick';
    nom.pick = 'tidy';
  }
  paint();
  updateWake();
}

/** Close the panel: the listening and a reading being heard stop. */
function closeNom(draw = true) {
  if (!S.nom) return;
  S.nom = null;
  stopListening();
  if (S.hearing.startsWith('nom|')) stopHearing(false);
  if (draw) paint();
  updateWake();
}

/**
 * Hear one reading alone (its parts together, at the mix's speed, in the voices it starts in),
 * or stop it. Not over the mix: the mix stops first.
 */
async function hearReading(id) {
  const nom = S.nom;
  const parts = nom?.result?.[id];
  if (!parts) return;
  const key = `nom|${id}`;
  if (S.hearing === key) { stopHearing(); return; }
  if (heldNow() || soundOff()) return;
  const ac = audio();
  if (!ac) { say(SAY.noSound, 'bad'); return; }
  stopPlay(false);
  nom.pick = id;
  S.hearing = key;
  A.hearKey = '';
  const bpm = S.mix.bpm;
  const swing = backingSwing(S.mix);
  const made = `${id}|${bpm}|${swing}|${ac.sampleRate}`;
  if (!nom.bufs.has(made)) {
    nom.bufs.set(made, Promise.all(parts.map((p) => renderEvents(p.notes, {
      bpm, steps: Math.max(1, p.beats) * 2, swing: p.follows ? swing : 0, voice: readingVoice(id, p.role) || NOTES_VOICE, sampleRate: ac.sampleRate,
    }))).catch(() => null));
  }
  const job = nom.bufs.get(made);
  S.hearWait = job.ready ? '' : key;
  paint();
  try { await ac.resume(); } catch { /* the next tap */ }
  const bufs = await job;
  if (bufs) job.ready = true;
  else nom.bufs.delete(made);
  if (S.hearing !== key || S.nom !== nom) return;
  const waited = S.hearWait === key;
  S.hearWait = '';
  if (!bufs) { S.hearing = ''; say(SAY.partBroken); return; }
  if (waited) paint();
  newBus();
  const when = ac.currentTime + 0.05;
  let len = 0;
  for (const b of bufs) { startSource(b, when, 0, b.duration, { sharp: true }); len = Math.max(len, b.duration); }
  clearTimeout(A.hearTimer);
  A.hearTimer = setTimeout(() => { if (S.hearing === key) stopHearing(); }, len * 1000 + 150);
}

/** Use the picked reading: the take becomes notes (Undo brings the take back). */
function useNom() {
  const nom = S.nom;
  const parts = nom?.result?.[nom.pick];
  if (!parts || busyNow()) return;
  const r = takeToNotes(S.mix, nom.id, parts, nom.result.key);
  if (r.error) { toast(r.error); return; }
  closeNom(false);
  const fresh = commit(r.mix, { select: r.ids[0], quiet: true });
  say(`${SAY.nomDone}${fresh ? ` ${stickerNews(fresh)}` : ''}`, 'good');
}

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
    await flushSave(true); // the slot save below says so if the tablet is full
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
    syncLoop();
    S.clean = fingerprint(S.mix);
    S.sel = null;
    S.unmuteTo = [];
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
    S.unmuteTo = [];
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
  'studio-back': () => {
    const back = deskOf(deskId())?.back || { view: 'kid' };
    leave();
    Object.assign(ui, back, { studioTest: false });
    render();
  },
  // Settings › Try the recording studio: only from the parent's screen, which is behind the PIN
  'studio-test': () => { if (ui.view === 'parent') openStudio({ test: true }); },
  'st-play': () => {
    if (A.play || S.busy === 'play') stopPlay();
    else if (!A.rec) startPlay(0);
  },
  'st-rec': () => {
    const down = A.down && performance.now() - A.down.t < 1500 ? A.down.at : null;
    A.down = null;
    // Stop while the music for a recording is being made: no recording (the microphone closes)
    if (S.busy === 'mic' && S.waiting === 'rec') { A.token += 1; S.busy = ''; S.waiting = ''; paint(); return; }
    if (A.rec?.kind === 'take') finishRecording({ down });
    else startRecording();
  },
  // a second tap on Stop, after the take is kept, must not take it away
  'st-undo': () => { if (performance.now() - A.keptAt > UNDO_REST && !busyNow()) undo(); },
  'st-redo': () => { if (performance.now() - A.keptAt > UNDO_REST && !busyNow()) redo(); },
  'st-retry': () => { if (S.kid) openDesk(S.kid); },
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
  'st-back-add': (el) => {
    if (busyNow()) return;
    const spot = currentSpot();
    if (!spot) { toast(SAY.full); return; }
    const r = addBacking(S.mix, spot.track, el.dataset.pattern, S.loop, spot.beat);
    if (r.error) { toast(r.error); return; }
    S.spot = { ...S.spot, picked: false };
    commit(r.mix, { select: r.id });
  },
  'st-back-hear': (el) => hearBacking(el.dataset.pattern),
  'st-loop': (el) => {
    const loop = el.dataset.loop;
    if (!LOOPS[loop] || busyNow()) return;
    S.loop = loop;
    // the backing tracks already in the mix follow the chords picked
    const r = setLoop(S.mix, loop);
    if (!r.changed) { paint(); return; }
    // a clip moved higher or lower that the new chords took too far moved back
    const back = r.moved.map(({ id, octaves }) => {
      const name = BACKING[findClip(r.mix, id)?.clip.pattern]?.name || 'A backing track';
      return `${name} moved ${octavesWord(Math.abs(octaves))} ${octaves > 0 ? 'higher' : 'lower'}, so its notes aren't too ${octaves > 0 ? 'low' : 'high'} to hear well.`;
    });
    remixDone(r, [`Your backing tracks play the ${LOOPS[loop].name} chords now.`, ...back].join(' '), { toast: true });
  },
  'st-vol': (el) => {
    const t = Number(el.dataset.track);
    S.volTrack = S.volTrack === t ? null : t;
    paint();
  },
  'st-vol-step': (el) => {
    const t = S.volTrack;
    if (t == null || busyNow()) return;
    const d = Number(el.dataset.d);
    const v = trackVolume(S.mix, t);
    if (d > 0 && v >= VOLUME_TOP) { toast('That\'s as loud as it goes.'); return; }
    if (d < 0 && v === 0) { toast('This track is muted already.'); return; }
    const r = setTrackVolume(S.mix, t, v + d);
    if (r.error) { toast(r.error); return; }
    commit(r.mix);
  },
  'st-vol-mute': () => {
    const t = S.volTrack;
    if (t == null || busyNow()) return;
    // Unmute goes back to the level the track had when it was muted (this visit), else the usual
    const v = trackVolume(S.mix, t);
    const r = setTrackVolume(S.mix, t, v === 0 ? S.unmuteTo[t] ?? USUAL_VOLUME : 0);
    if (r.error) { toast(r.error); return; }
    S.unmuteTo[t] = v === 0 ? null : v;
    commit(r.mix);
  },
  'st-chooser': (el) => {
    if (S.sel == null) return;
    const what = el.dataset.what;
    S.chooser = S.chooser?.id === S.sel && S.chooser.what === what ? null : { id: S.sel, what };
    S.said = '';
    paint();
  },
  'st-voice': (el) => {
    if (busyNow() || S.sel == null) return;
    const id = S.sel;
    const voice = el.dataset.voice || null;
    const before = findClip(S.mix, id)?.clip;
    if (!before) return;
    if ((before.voice || null) === voice) { hearClip(id); return; } // the same voice: just hear it again
    const r = setVoice(S.mix, id, voice);
    if (r.error) { toast(r.error); return; }
    const name = voice ? VOICES[voice].name : '';
    const moved = r.octaves ? ` It moved ${octavesWord(Math.abs(r.octaves))} ${r.octaves > 0 ? 'higher' : 'lower'}, where ${name} sounds best.` : '';
    remixDone(r, voice && findClip(r.mix, id).clip.voice ? `Now it plays as ${name}.${moved}` : 'Back to its own sound.');
    hearClip(id);
  },
  'st-kit': (el) => {
    if (busyNow() || S.sel == null) return;
    const kit = el.dataset.kit;
    const before = findClip(S.mix, S.sel)?.clip;
    if (!before || !KITS[kit]) return;
    if ((before.kit || 'chip') === kit) { hearClip(S.sel); return; }
    remixDone(setKit(S.mix, S.sel, kit), `Now it plays on the ${KITS[kit].name}.`);
    hearClip(S.sel);
  },
  'st-shift': (el) => {
    if (busyNow() || S.sel == null) return;
    const by = Number(el.dataset.d);
    remixDone(shiftClip(S.mix, S.sel, by), by > 0 ? 'One octave higher.' : 'One octave lower.');
  },
  'st-fit': () => {
    if (busyNow() || S.sel == null) return;
    remixDone(moveIntoKey(S.mix, S.sel), `Moved into ${keyLabel(S.mix.key)}. Now it goes with your mix.`);
  },
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
  'st-nom': (el) => {
    if (el.getAttribute('aria-disabled') === 'true') { toast(SAY.nomMissing); return; }
    if (!busyNow()) openNom();
  },
  'st-nom-close': () => closeNom(),
  'st-nom-pick': (el) => {
    const nom = S.nom;
    const id = el.dataset.reading;
    if (!nom?.result?.[id]) return;
    // another card stops the one being heard
    if (S.hearing.startsWith('nom|') && S.hearing !== `nom|${id}`) stopHearing(false);
    nom.pick = id;
    paint();
  },
  'st-nom-hear': (el) => hearReading(el.dataset.reading),
  'st-nom-use': () => useNom(),
};

/** What the studio's sound is doing (for tests): { playing, recording, sounds, tracks (each track's loudness now, while it plays) }. */
export function studioSound() {
  return { playing: Boolean(A.play), recording: Boolean(A.rec), sounds: A.sources.size, ...(A.lanes ? { tracks: A.lanes.map((g) => g.gain.value) } : {}) };
}

/** The Note-o-Matic (for tests): { phase, progress, pick, worker (listening in a Worker) } or null. */
export function studioNotes() {
  return S.nom && { phase: S.nom.phase, progress: S.nom.progress, pick: S.nom.pick, worker: Boolean(N.worker) };
}

/** What the studio is hearing on its own (for tests): '' or a key such as 'nom|tidy'. */
export const studioHearing = () => S.hearing;

/** The clicks of the recording under way (for tests): { rate, from, countIn, clicks } or null. */
export function studioRec() {
  const r = A.rec;
  return r?.kind === 'take' ? { rate: A.ac.sampleRate, from: r.from, countIn: r.countIn, clicks: r.clicks } : null;
}

/** Open the studio: a kid's desk (the music house), or with `test` the parent's test desk. */
export function openStudio({ test = false } = {}) {
  ui.studioTest = test;
  ui.view = 'studio';
  render();
  window.scrollTo(0, 0);
}
