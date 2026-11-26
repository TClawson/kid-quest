// The buddy station: a parent's Android phone, brought into the kids' room at chore time and
// taken out again (Taylor's rule: no internet-connected phone is left on and unlocked in the
// kids' room). Kids tap printed chore tokens (NFC stickers) on it.
//
// - Parents › Settings › Buddy station (stationCard): link each token to one kid's chore, set
//   each chore's song length, check what a token is linked to, and start the station.
// - The station screen (viewStation): the kids' buddies resting on a dark screen. The first tap
//   of a token starts that chore and a work song (a placeholder: the kid's map song, with a soft
//   chime over its last part); the buddy sways along and a bar shows the song left. The second tap,
//   20 seconds or more later, checks the chore off as the kid's own "I did it" would, with
//   by: 'token', and the buddy dances. A song that ends first leaves the buddy humming and
//   waiting; nothing nags. Two kids can work at once; one song plays, the first started.
//   Leaving takes the parent PIN (app.js 'station-exit'). The station opens no other screen.
//
// Every tap comes in through onTap(serial), so a WiFi reader can feed the same screen later.
// The rules live in stationrules.js. One tap saves only that chore's record for the day.
// Station mode and the chores in play are kept in this module only: nothing about the station
// goes to the family, and closing the app ends it (in-play chores come back from the records).

import { state, ui, save, render, today, esc, kidById, taskById, liveKey, dressed, toast, cloud, cloudCfg, kidTheme } from './ctx.js';
import { applyTaskChange, entryFor, tasksForDay } from './logic.js';
import { sounds, confetti } from './fx.js';
import { liveHtml, live, partyAll } from './live.js';
import { startMusic, stopMusic, musicContext } from './music.js';
import { nfcSupported, nfcState, nfcPermission, startNfc, startNfcIfAllowed, stopNfc, onNfcChange } from './nfc.js';
import {
  SONG_MINUTES, defaultSong, linkable, findToken, tokensFor, linkToken, unlinkToken, setSong,
  freshTap, inPlayFrom, decideTap, songProgress, songLead,
} from './stationrules.js';

const PARTY_MS = 5000;
const MSG_MS = 4000;
const CHIME_EVERY = 2000;

const S = {
  // the station screen
  day: '',
  playing: new Map(), // kidId -> { serial, task, startedAt, song }
  ended: new Set(),   // kidIds whose song has ended (humming)
  reads: new Map(),   // serial -> last reading (the five-second rule)
  party: null,        // { kidId, task, until, flourish, pending }
  msg: null,          // { kidId, text, until }
  tick: 0,
  chimeAt: 0,
  wake: null,
  wantWake: false,
  // the settings card
  linkWant: null,     // { kidId, taskId } while waiting for a token to link
  cardReads: new Map(),
  last: null,         // { serial, text } what the latest token on the card is
  unwatch: null,
};

const todayIds = (kid) => tasksForDay(state, kid, today(), today()).map((t) => t.id);
const recordsOf = (kid) => entryFor(state, kid.id, today())?.tasks || {};
const behind = () => Boolean(cloudCfg) && !cloud?.gotState;
const taskName = (kid, taskId) => {
  const t = taskById(kid, today(), taskId);
  return t ? `${t.icon || ''} ${t.name}`.trim() : 'a chore that\'s gone';
};

// ---------- Parents › Settings › Buddy station ----------

/** The Buddy station card in Parents › Settings. */
export function stationCard() {
  if (!nfcSupported()) {
    return `
    <div class="card station-card" data-station-card="unsupported">
      <h2>🧸 Buddy station</h2>
      <p class="muted small">This device can't read chore tokens. The buddy station works in Chrome on an Android phone with NFC.</p>
    </div>`;
  }
  if (behind()) {
    return `
    <div class="card station-card" data-station-card="waiting">
      <h2>🧸 Buddy station</h2>
      <p class="muted small">Opens once this phone has the family's latest copy.</p>
    </div>`;
  }
  const r = nfcState();
  const want = S.linkWant && kidById(S.linkWant.kidId);
  const kids = state.kids.map((kid) => {
    const rows = kid.tasks.filter(linkable).map((task) => {
      const serials = tokensFor(kid, task.id);
      const song = serials.length ? kid.tokens[serials[0]].song : 0;
      const waiting = S.linkWant?.kidId === kid.id && S.linkWant?.taskId === task.id;
      const data = `data-kid="${kid.id}" data-task="${task.id}"`;
      return `<div class="bs-link ${serials.length ? 'linked' : ''}" ${data}>
          <span class="ic" aria-hidden="true">${esc(task.icon || '•')}</span>
          <span class="tx"><b>${esc(task.name)}</b><small>${serials.length ? `🔗 ${serials.length === 1 ? 'Token linked' : `${serials.length} tokens linked`}` : 'No token'}</small></span>
          ${serials.length ? `<label class="bs-song">Song <select data-station-song ${data} aria-label="Song length for ${esc(task.name)}">${SONG_MINUTES.map((m) => `<option value="${m * 60}" ${song === m * 60 ? 'selected' : ''}>${m} min</option>`).join('')}${SONG_MINUTES.includes(song / 60) ? '' : `<option value="${song}" selected>${Math.round(song / 6) / 10} min</option>`}</select></label>` : ''}
          ${waiting
    ? `<button class="btn ghost mini" data-action="station-link-cancel">Cancel</button>`
    : `<button class="btn ${serials.length ? 'ghost' : ''} mini" data-action="station-link" ${data}>${serials.length ? 'Link another' : 'Link'}</button>`}
          ${serials.length ? `<button class="linkish" data-action="station-unlink" ${data} aria-label="Unlink the token for ${esc(task.name)}">✕</button>` : ''}
        </div>`;
    }).join('');
    return `<div class="bs-kid-links"><h3>${esc(kid.name)}</h3>${rows || '<p class="muted small">No chores a token can stand for.</p>'}</div>`;
  }).join('');
  const linked = state.kids.some((k) => Object.keys(k.tokens || {}).length);
  return `
    <div class="card station-card" data-station-card="ready">
      <h2>🧸 Buddy station</h2>
      <p class="muted small">Bring this phone into the room at chore time. A kid taps a chore token once to start it with a song, and again when it's done. Pin the app (Android's app pinning) before handing the phone over; leaving the station takes the parent PIN.</p>
      ${want
    ? `<p class="bs-hold" data-station-hold><b>Hold the token for ${esc(want.name)}'s ${esc(taskName(want, S.linkWant.taskId))} to the back of the phone…</b></p>`
    : r.scanning ? '<p class="muted small" data-station-reading>📡 Tap any token to see what it\'s linked to.</p>' : ''}
      ${S.last ? `<p class="bs-last" data-station-last>${esc(S.last.text)}</p>` : ''}
      ${r.error ? `<p class="listen-error">${esc(r.error)}</p>` : ''}
      ${!r.scanning && !want ? '<button class="btn ghost" data-action="station-read">📡 Check a token</button>' : ''}
      ${kids || '<p class="muted small">Add kids first.</p>'}
      <button class="btn huge" data-action="station-start" ${linked ? '' : 'disabled'}>▶ Start the station</button>
      ${linked ? '' : '<p class="muted small">Link a token first.</p>'}
    </div>`;
}

/** After each redraw: keep the card up to date while it's on screen; stop reading when it's gone. */
export function mountStationCard(root) {
  const card = root.querySelector('[data-station-card="ready"]');
  if (ui.view === 'station') return;
  if (!card) {
    if (S.unwatch || S.linkWant || nfcState().scanning) { stopNfc(); S.linkWant = null; S.last = null; S.unwatch?.(); S.unwatch = null; }
    return;
  }
  if (!card.dataset.live) {
    card.dataset.live = '1';
    card.addEventListener('change', onSongChange);
  }
  // reading starts from the parent's tap (Link, or Check a token), never just by opening Settings
  if (!S.unwatch) S.unwatch = onNfcChange(() => render());
}

function onSongChange(e) {
  const sel = e.target.closest('[data-station-song]');
  if (!sel) return;
  const kid = kidById(sel.dataset.kid);
  if (kid && setSong(kid, sel.dataset.task, Number(sel.value))) { save(); render(); }
}

function onCardRead(serial, at) {
  const fresh = freshTap(S.cardReads, serial, at);
  if (S.linkWant) {
    const { kidId, taskId } = S.linkWant;
    const kid = kidById(kidId);
    const task = kid?.tasks.find((t) => t.id === taskId);
    S.linkWant = null;
    if (!kid || !task) { render(); return; }
    const was = findToken(state.kids, serial);
    const moved = was && (was.kid.id !== kidId || was.link.task !== taskId) ? ` (moved from ${was.kid.name}'s ${taskName(was.kid, was.link.task)})` : '';
    linkToken(state.kids, kidId, serial, taskId, was?.kid.id === kidId && was.link.task === taskId ? undefined : defaultSong(task));
    save();
    sounds.task();
    S.last = { serial, text: `✓ Linked to ${kid.name}'s ${taskName(kid, taskId)}${moved}.` };
    render();
    return;
  }
  if (!fresh) return;
  const found = findToken(state.kids, serial);
  sounds.tap();
  S.last = { serial, text: found
    ? `That token is ${found.kid.name}'s ${taskName(found.kid, found.link.task)} (${Math.round((found.link.song || 120) / 6) / 10} min song).`
    : 'That token isn\'t linked to anything yet.' };
  render();
}

export const stationActions = {
  'station-link': async (el) => {
    S.linkWant = { kidId: el.dataset.kid, taskId: el.dataset.task };
    S.last = null;
    render();
    // from the parent's tap, so Chrome may ask for NFC here
    if (!(await startNfc(onCardRead))) { S.linkWant = null; render(); }
  },
  'station-link-cancel': () => { S.linkWant = null; render(); },
  'station-read': () => { startNfc(onCardRead); },
  'station-unlink': (el) => {
    const kid = kidById(el.dataset.kid);
    if (!kid) return;
    for (const serial of tokensFor(kid, el.dataset.task)) unlinkToken(state.kids, serial);
    save();
    S.last = { serial: '', text: `Unlinked ${kid.name}'s ${taskName(kid, el.dataset.task)}.` };
    render();
  },
  'station-start': () => openStation(),
  'station-allow': () => { startNfc(onTap); },
};

// ---------- the station screen ----------

/** Open the station screen (from the parent's tap on Start). */
export function openStation() {
  if (behind()) { toast('Waiting for the family\'s latest copy first.'); return; }
  S.unwatch?.(); S.unwatch = null;
  S.linkWant = null; S.last = null;
  S.day = today();
  S.playing = inPlayFrom(state.kids, recordsOf, todayIds);
  S.ended = new Set();
  S.reads = new Map();
  S.party = null; S.msg = null;
  // the parent's tap lets sound play later, when a token (not a tap) starts a song
  try { musicContext()?.resume?.(); } catch { /* no sound */ }
  sounds.tap();
  ui.view = 'station';
  S.unwatch = onNfcChange(() => { if (ui.view === 'station') render(); });
  startNfcIfAllowed(onTap);
  S.wantWake = true;
  takeWake();
  clearInterval(S.tick);
  S.tick = setInterval(tick, 500);
  render();
  window.scrollTo(0, 0);
}

/** Leave the station (after the parent PIN): stop reading, the song and the wake lock. */
export function leaveStation() {
  clearInterval(S.tick);
  S.tick = 0;
  stopNfc();
  S.unwatch?.(); S.unwatch = null;
  stopMusic();
  S.wantWake = false;
  releaseWake();
  S.playing = new Map();
  S.party = null; S.msg = null;
}

/** For tests: what the station is doing. */
export function stationState() {
  return {
    open: ui?.view === 'station',
    playing: [...S.playing].map(([kidId, p]) => ({ kidId, ...p })),
    ended: [...S.ended],
    party: S.party && { ...S.party },
    msg: S.msg?.text || '',
    wake: Boolean(S.wake),
    reading: nfcState().scanning,
  };
}

/**
 * One reading of a token: the only way taps reach the station (the phone's own reader now; a
 * WiFi reader could call this too).
 */
export function onTap(serial, now = Date.now()) {
  if (ui.view !== 'station') return;
  const fresh = freshTap(S.reads, serial, now);
  if (!fresh) return;
  if (behind()) { say(null, 'Waiting for the family\'s latest copy…', now); render(); return; }
  newDay();
  const t = today();
  const found = findToken(state.kids, serial);
  const kid = found?.kid;
  const taskId = found?.link.task;
  const task = kid && taskById(kid, t, taskId);
  const r = decideTap({
    fresh,
    found,
    onToday: Boolean(kid) && todayIds(kid).includes(taskId),
    record: kid ? recordsOf(kid)[taskId] || null : null,
    playing: kid ? S.playing.get(kid.id) || null : null,
    task,
    now,
  });
  if (r.kind === 'unlinked') {
    for (const k of restingKids()) live(liveKey(k)).surprise();
    sounds.error();
    say(null, '🤔 That token isn\'t linked yet. A parent can link it in Settings.', now);
  } else if (r.kind === 'wave') {
    live(liveKey(kid)).hop();
    sounds.tap();
    const text = {
      done: `⭐ ${kid.name}, that one's already done!`,
      'not-today': `${kid.name}, that one isn't on today's list.`,
      soon: '👋 Keep going! Tap again when it\'s done.',
      busy: `👋 ${kid.name}, finish ${r.playing ? taskName(kid, r.playing.task) : 'the other one'} first!`,
    }[r.reason];
    say(kid.id, text, now);
  } else if (r.kind === 'start') {
    applyTaskChange(state, kid.id, t, taskId, r.save);
    save();
    S.playing.set(kid.id, { serial, task: taskId, startedAt: now, song: found.link.song || defaultSong(task) });
    S.ended.delete(kid.id);
    if (S.party?.kidId === kid.id) S.party = null;
    live(liveKey(kid)).surprise();
    sounds.catch();
    S.msg = null;
    setTimeout(() => syncSong(Date.now()), 700);
  } else if (r.kind === 'finish') {
    applyTaskChange(state, kid.id, t, taskId, r.save);
    save();
    const p = S.playing.get(kid.id);
    const flourish = Boolean(p) && songProgress(p, now).left > 0;
    S.playing.delete(kid.id);
    S.ended.delete(kid.id);
    S.party = { kidId: kid.id, task: taskId, until: now + PARTY_MS, flourish, pending: r.save.status === 'pending' };
    S.msg = null;
    partyAll([liveKey(kid)], PARTY_MS);
    sounds.task();
    if (flourish) setTimeout(() => sounds.fanfare(), 350);
    confetti(flourish ? 140 : 90, 2400);
    syncSong(now);
  }
  render();
}

function say(kidId, text, now) {
  S.msg = { kidId, text, until: now + MSG_MS };
}

/** A new day: chores in play from yesterday are dropped. */
function newDay() {
  if (S.day === today()) return false;
  S.day = today();
  S.playing = new Map();
  S.ended = new Set();
  S.party = null;
  syncSong(Date.now());
  return true;
}

/** The song: the chore in play started first, while its song lasts; a soft chime over its last part. */
function syncSong(now) {
  if (ui.view !== 'station') return;
  const lead = songLead(S.playing, now);
  const kid = lead && kidById(lead);
  if (!kid || !state.settings.sound || document.visibilityState !== 'visible') { stopMusic(); return; }
  startMusic(kidTheme(kid));
  if (songProgress(S.playing.get(lead), now).ending && now - S.chimeAt >= CHIME_EVERY) {
    S.chimeAt = now;
    sounds.chime();
  }
}

function tick() {
  if (ui.view !== 'station') { clearInterval(S.tick); S.tick = 0; return; }
  const now = Date.now();
  let redraw = newDay();
  // a chore checked off elsewhere (a parent's tick on another phone) is no longer in play
  for (const [kidId, p] of S.playing) {
    const kid = kidById(kidId);
    if (!kid || recordsOf(kid)[p.task]?.status) { S.playing.delete(kidId); S.ended.delete(kidId); redraw = true; }
  }
  for (const [kidId, p] of S.playing) {
    const g = songProgress(p, now);
    const bar = document.querySelector(`[data-station-bar="${kidId}"]`);
    if (bar) bar.style.width = `${Math.round((1 - g.part) * 100)}%`;
    if (g.left <= 0 && !S.ended.has(kidId)) {
      S.ended.add(kidId);
      sounds.chime();
      redraw = true;
    }
  }
  if (S.party && now >= S.party.until) { S.party = null; redraw = true; }
  if (S.msg && now >= S.msg.until) { S.msg = null; redraw = true; }
  syncSong(now);
  if (redraw) render();
}

/** Kids shown resting: those with a token linked (all kids when nobody has one), not working or celebrating. */
function restingKids() {
  const withTokens = state.kids.filter((k) => Object.keys(k.tokens || {}).length);
  const kids = withTokens.length ? withTokens : state.kids;
  return kids.filter((k) => !S.playing.has(k.id) && S.party?.kidId !== k.id);
}

const REST = { valence: 0.45, arousal: 0.2, sleep: 0.25 };
const WORK = { valence: 0.65, arousal: 0.45, dance: 0.35 };
const HUM = { valence: 0.5, arousal: 0.25, sing: 0.6, notes: true };

/** The station screen. */
export function viewStation() {
  const now = Date.now();
  const r = nfcState();
  const party = S.party && kidById(S.party.kidId);
  const working = [...S.playing].map(([kidId, p]) => ({ kid: kidById(kidId), p })).filter((x) => x.kid).sort((a, b) => a.p.startedAt - b.p.startedAt);
  const lead = songLead(S.playing, now);
  const big = [];
  if (party) {
    big.push(`<div class="bs-big bs-party" data-station-party="${party.id}" style="--kid:${party.color}">
        ${liveHtml(liveKey(party), dressed(party), { label: `${party.name}'s buddy, cheering` })}
        <b class="bs-name">${esc(party.name)}</b>
        <p class="bs-chore">🎉 ${esc(taskName(party, S.party.task))}${S.party.pending ? ' · a parent will check it' : ' · done!'}</p>
      </div>`);
  }
  for (const { kid, p } of working) {
    const g = songProgress(p, now);
    const humming = S.ended.has(kid.id) || g.left <= 0;
    big.push(`<div class="bs-big bs-work ${humming ? 'humming' : ''} ${lead === kid.id ? 'lead' : ''}" data-station-working="${kid.id}" style="--kid:${kid.color}">
        ${liveHtml(liveKey(kid), dressed(kid), { feel: humming ? HUM : WORK, label: `${kid.name}'s buddy, working along` })}
        <b class="bs-name">${esc(kid.name)}</b>
        <p class="bs-chore">${esc(taskName(kid, p.task))}</p>
        <div class="bs-bar" role="img" aria-label="${humming ? 'Song over' : `${Math.ceil(g.left)} seconds of song left`}"><i data-station-bar="${kid.id}" style="width:${Math.round((1 - g.part) * 100)}%"></i></div>
        <small class="bs-sub">${humming ? '♪ Humming… tap again when it\'s done' : lead === kid.id ? '♪' : '♪ (next song)'}</small>
      </div>`);
  }
  const resting = restingKids();
  const msgKid = S.msg?.kidId && kidById(S.msg.kidId);
  return `
    <div class="screen station ${big.length ? 'busy' : 'rest'}" data-station-view>
      <button class="bs-exit" data-action="station-exit" aria-label="Leave the station">✕</button>
      <div class="bs-stage">${big.join('')}</div>
      ${S.msg ? `<p class="bs-msg" data-station-msg ${msgKid ? `style="--kid:${msgKid.color}"` : ''}>${esc(S.msg.text)}</p>` : ''}
      ${!r.scanning ? `<div class="bs-reader">
          ${r.error ? `<p class="listen-error">${esc(r.error)}</p>` : ''}
          <button class="btn huge" data-action="station-allow" ${r.starting ? 'disabled' : ''}>📡 Start listening for tokens</button>
        </div>` : ''}
      <div class="bs-rest">${resting.map((k) => `
        <div class="bs-small" data-station-rest="${k.id}" style="--kid:${k.color}">
          ${liveHtml(liveKey(k), dressed(k), { feel: REST, label: `${k.name}'s buddy, resting` })}
          <small>${esc(k.name)}</small>
        </div>`).join('')}</div>
      ${!big.length && !S.msg ? '<p class="bs-hint">Tap a token to start a chore</p>' : ''}
    </div>`;
}

// ---------- keeping the screen awake ----------

async function takeWake() {
  if (!S.wantWake || S.wake || document.visibilityState !== 'visible' || !navigator.wakeLock?.request) return;
  try {
    const s = await navigator.wakeLock.request('screen');
    if (!S.wantWake) { s.release().catch(() => {}); return; }
    S.wake = s;
    s.addEventListener('release', () => { if (S.wake === s) S.wake = null; });
  } catch { /* the screen may sleep */ }
}

function releaseWake() {
  const s = S.wake;
  S.wake = null;
  s?.release().catch(() => {});
}

globalThis.document?.addEventListener('visibilitychange', () => {
  if (ui?.view !== 'station') return;
  // Chrome drops the wake lock when the page hides; take it again, and pick the song back up
  if (document.visibilityState === 'visible') { takeWake(); syncSong(Date.now()); nfcPermission(); }
});
