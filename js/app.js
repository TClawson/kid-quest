import {
  DAY_NAMES, defaultTasks, dateKey, addDays, parseKey, newId, entryFor,
  tasksForDay, snapshotToday, dayStatus, streakInfo, totalXp, totalCoins, levelFor, taskXp, taskCoins,
  defaultReward, parseReward, MAX_REWARD,
  pendingApprovals, fallbackHash, pianoStreakInfo,
  isExercise, taskGems, totalGems, exerciseStreakInfo, DEFAULT_GEMS, EXERCISE_DAYS,
  defaultAllowance, repairAllowanceStart, allowanceFor, parseAllowance, taskPay, taskSize, SIZES, weekEarnings, recentBonuses,
  DEFAULT_ALLOWANCE, DEFAULT_BONUS_LIMIT, questTasks,
  weekParity, isEveryOtherWeek, onWeek, weekStart,
} from './logic.js';
import { sounds, confetti, setSound } from './fx.js';
import { buddySvg, buddyLine, MOVE_ART, catchFor, ballSvg } from './avatar.js';
import { liveHtml, live, liveStart, feel } from './live.js';
import { paintQuestMaps, mapTheme } from './maparts.js';
import { startMusic, stopMusic } from './music.js';
import {
  SPECIES, SLOTS, ITEMS, itemById, isUnlocked, needLabel, needGap, pianoDaysNeeded, newUnlocks, LEGACY_LEVEL, defaultBuddy, restingMood, isWorn, ownedFor, addOwned, fitsSpecies, moveWornToBuddy, switchSpecies,
  SPORTS, MOVES, unlockedMoves, pickMove, moveWeeks, bestGear,
} from './items.js';
import { pickVisitors, visitorLines, planVisits } from './visits.js';
import { gameFor } from './play.js';
import { openPlay } from './playground.js';
import { runSeconds, CHEERS, pickCheer } from './practice.js';
import { startListening, buddyState, TUNING } from './listen.js';
import { createBeatFollower } from './beat.js';
import { loadRecognizer } from './hear.js';
import { createStore, migrate, localBackend, splitState, stableJson, DEVICE_SETTINGS } from './store.js';

const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac'];

// ---------- storage ----------

// When this device syncs with a family, kidquest.cloud holds { familyId, role,
// kidId, email } and the data is kept in kidquest.cloud.cache plus Firebase.
// The original kidquest.v1 copy is left untouched as a fallback.
const CLOUD_KEY = 'kidquest.cloud';
const CLOUD_CACHE_KEY = 'kidquest.cloud.cache';
const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const cloudCfg = readJson(CLOUD_KEY);
const BUDDIES_KEY = 'kidquest.cloud.buddies';
// Other family members' buddies (a kid's device only syncs its own kid).
const family = { buddies: cloudCfg ? readJson(BUDDIES_KEY) : null };
const cloud = { mod: null, ready: false, pending: 0, error: '', signedOut: false, queued: null };

function cloudWrite(changes, before, after) {
  if (!cloud.ready) {
    // not connected yet: remember everything since the first unsent save
    cloud.queued = { before: cloud.queued ? cloud.queued.before : before, after };
    return;
  }
  cloud.mod.writeChanges(cloudCfg.familyId, changes, before, after, onCloudStatus);
}

const store = cloudCfg
  ? createStore(localBackend(localStorage, CLOUD_CACHE_KEY), { onSave: cloudWrite })
  : createStore();

function save() {
  try {
    store.save(state);
  } catch {
    toast('Could not save. Is storage full?');
  }
}

let state = store.load();
if (cloudCfg && !localStorage.getItem(CLOUD_CACHE_KEY)) {
  // first start after joining on a device with nothing to bring: keep this
  // device's own sound and map settings, wait for the family's data
  const local = createStore().load();
  for (const k of DEVICE_SETTINGS) if (k in local.settings) state.settings[k] = local.settings[k];
}
setSound(state.settings.sound);

const ui = {
  view: state.settings.pinHash ? 'home' : 'setup',
  kidId: null,
  taskId: null,
  tab: 'approvals',
  editKidId: null,
  historyDate: null,
  slot: 'hat',
  cheerUntil: 0,
};

// ---------- helpers ----------

const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const today = () => dateKey();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kidById = (id) => state.kids.find((k) => k.id === id);

function progressFor(kid) {
  const t = today();
  const info = streakInfo(state, kid, t);
  const xp = totalXp(state, kid, t);
  const lv = levelFor(xp);
  const piano = pianoStreakInfo(state, kid, t);
  if (!Array.isArray(kid.owned)) {
    // first run with the shop: keep anything the kid had already reached by level, for free
    kid.owned = ITEMS.filter((i) => i.price && LEGACY_LEVEL(i) <= lv.level).map((i) => i.id);
    kid.spent = 0;
    moveWornToBuddy(kid);
    save();
  }
  const coins = Math.max(0, totalCoins(state, kid, t) - (kid.spent || 0));
  const gems = Math.max(0, totalGems(state, kid, t) - (kid.gemsSpent || 0));
  const ex = exerciseInfo(kid);
  return { ...info, level: lv.level, into: lv.into, piano: piano.streak, pianoBest: piano.best, pianoPerWeek: piano.perWeek, owned: ownedFor(kid), coins, gems, ex };
}

/**
 * The kid's exercise streak. The best run is also kept on the kid (kid.exBest),
 * so other kids' devices, which don't load this kid's days, know which moves
 * this buddy can do when it visits.
 */
function exerciseInfo(kid) {
  const ex = exerciseStreakInfo(state, kid, today());
  if ((kid.exBest || 0) < ex.best) { kid.exBest = ex.best; save(); }
  return ex;
}

/** Everything a buddy needs to do its moves: its look, the kid's gear, and how far the exercise streak got. */
const mover = (kid) => ({ buddy: kid.buddy, owned: kid.owned || [], exBest: Math.max(kid.exBest || 0, exerciseInfo(kid).best) });

function missedYesterday(kid, info) {
  const t = today();
  const y = addDays(t, -1);
  if (kid.startDate && y < kid.startDate) return false;
  const s = dayStatus(state, kid, y, t);
  return !s.complete && !s.excused && !info.frozen.includes(y);
}

function moodFor(kid) {
  if (ui.view === 'kid' && ui.cheerKid === kid.id && Date.now() < ui.cheerUntil) return 'excited';
  const t = today();
  const s = dayStatus(state, kid, t, t);
  const info = streakInfo(state, kid, t);
  return restingMood({ todayDone: s.done, todayComplete: s.complete, missedYesterday: missedYesterday(kid, info) });
}

/**
 * How a kid's buddy feels right now (rig.js feelings), from how the day is going:
 * proud and sparkly once everything is done, sad after a missed day until a task
 * is done, calm before the first task, a bit bouncier with a long streak, and
 * drowsy early in the morning and late at night.
 */
function feelFor(kid, mood = moodFor(kid)) {
  const f = {
    excited: { valence: 0.95, arousal: 0.95 },
    proud: { valence: 0.9, arousal: 0.7 },
    happy: { valence: 0.6, arousal: 0.55 },
    sleepy: { valence: 0.35, arousal: 0.4 },
    sad: { valence: -0.7, arousal: 0.3 },
  }[mood] || { valence: 0.6, arousal: 0.55 };
  const streak = streakInfo(state, kid, today()).streak;
  if (streak >= 7 && mood !== 'sad') f.arousal = Math.min(1, f.arousal + 0.1);
  const hour = new Date().getHours();
  if ((hour < 7 || hour >= 21) && mood !== 'excited') { f.arousal = Math.min(f.arousal, 0.25); f.sleep = 0.3; }
  return f;
}

const liveKey = (kid) => `kid:${kid.id}`;

/**
 * A kid's buddy. size: css class for sizing. opts.live: drawn live by rig.js
 * (it moves, feels and reacts to taps); otherwise the still picture from avatar.js.
 * opts.feel: feelings to use instead of feelFor; opts.idle: gets bored when left alone.
 */
function buddyHtml(kid, mood, size = 'lg', opts = {}) {
  if (opts.live) {
    const html = liveHtml(liveKey(kid), kid.buddy, { background: opts.background !== false, feel: opts.feel || feelFor(kid, mood), idle: opts.idle, label: `${kid.name}'s buddy` });
    return `<div class="buddy buddy-${size} live">${html}</div>`;
  }
  return `<div class="buddy buddy-${size} mood-${mood}">${buddySvg(kid.buddy, mood, opts)}</div>`;
}
const buddyChip = (kid) => `<span class="avatar xs buddy-chip">${buddySvg(kid.buddy, 'happy', { background: false })}</span>`;
const taskById = (kid, key, id) => tasksForDay(state, kid, key, today()).find((t) => t.id === id) || kid.tasks.find((t) => t.id === id);

function friendlyDate(key) {
  const t = today();
  if (key === t) return 'Today';
  if (key === addDays(t, -1)) return 'Yesterday';
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function floatText(text, anchor) {
  const el = document.createElement('div');
  el.className = 'float-xp';
  el.textContent = text;
  const r = anchor?.getBoundingClientRect?.();
  el.style.left = `${r ? r.left + r.width / 2 : window.innerWidth / 2}px`;
  el.style.top = `${r ? r.top : window.innerHeight / 2}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

async function hashPin(pin) {
  const text = `kidquest:${pin}`;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return `sha256:${[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return fallbackHash(text);
  }
}

async function pinMatches(pin) {
  const h = state.settings.pinHash || '';
  if (h.startsWith('djb2:')) return fallbackHash(`kidquest:${pin}`) === h;
  return (await hashPin(pin)) === h;
}

// ---------- modals ----------

let modalOnClose = null;

function openModal(html, onClose = null) {
  $modal.innerHTML = `<div class="modal-card">${html}</div>`;
  $modal.hidden = false;
  modalOnClose = onClose;
}

function closeModal() {
  $modal.hidden = true;
  $modal.innerHTML = '';
  const cb = modalOnClose;
  modalOnClose = null;
  cb?.();
  if (pendingRemote && $modal.hidden) { const next = pendingRemote; pendingRemote = null; applyRemote(next); }
}

$modal.addEventListener('click', (e) => {
  if (e.target === $modal && !$modal.querySelector('[data-sticky]')) closeModal();
});

/** Number pad. mode 'check' verifies the parent PIN; mode 'new' asks for a new PIN twice. */
function pinPad({ title, subtitle = '', mode = 'check', onSuccess }) {
  let entered = '';
  let first = null;
  // Redraw only the card's contents after the first draw, so the open animation doesn't replay on every key.
  const draw = (msg = subtitle, shake = false) => {
    const card = $modal.querySelector('.modal-card');
    const show = card && !$modal.hidden && card.querySelector('.pin')
      ? (html) => { card.innerHTML = html; }
      : (html) => openModal(html);
    show(`
      <div data-sticky class="pin ${shake ? 'shake' : ''}">
        <h2>${esc(title)}</h2>
        <p class="muted">${esc(msg)}</p>
        <div class="pin-dots">${[0, 1, 2, 3].map((i) => `<span class="${i < entered.length ? 'on' : ''}"></span>`).join('')}</div>
        <div class="pin-keys">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-pin="${n}">${n}</button>`).join('')}
          <button data-pin="cancel" class="small">Cancel</button>
          <button data-pin="0">0</button>
          <button data-pin="back" class="small">⌫</button>
        </div>
      </div>`);
  };
  const onKey = async (e) => {
    const b = e.target.closest('[data-pin]');
    if (!b) return;
    const k = b.dataset.pin;
    if (k === 'cancel') {
      $modal.removeEventListener('click', onKey);
      closeModal();
      return;
    }
    if (k === 'back') entered = entered.slice(0, -1);
    else if (entered.length < 4) entered += k;
    sounds.tap();
    if (entered.length < 4) {
      draw(first ? 'Type it again to confirm' : subtitle);
      return;
    }
    if (mode === 'check') {
      if (await pinMatches(entered)) {
        $modal.removeEventListener('click', onKey);
        closeModal();
        onSuccess();
      } else {
        entered = '';
        sounds.error();
        draw('Wrong PIN, try again', true);
      }
    } else if (!first) {
      first = entered;
      entered = '';
      draw('Type it again to confirm');
    } else if (first === entered) {
      state.settings.pinHash = await hashPin(entered);
      save();
      $modal.removeEventListener('click', onKey);
      closeModal();
      onSuccess();
    } else {
      first = null;
      entered = '';
      sounds.error();
      draw("Those didn't match. Start again.", true);
    }
  };
  draw();
  $modal.addEventListener('click', onKey);
}

function confirmModal({ title, text, yes = 'Yes', no = 'Cancel', danger = false, onYes }) {
  openModal(`
    <h2>${esc(title)}</h2>
    <p>${esc(text)}</p>
    <div class="row end">
      <button class="btn ghost" data-action="modal-close">${esc(no)}</button>
      <button class="btn ${danger ? 'danger' : ''}" data-action="modal-yes">${esc(yes)}</button>
    </div>`);
  modalYes = onYes;
}
let modalYes = null;

// ---------- celebrations ----------

function celebrate({ kid, emoji, title, text, sound, big = false, onClose = null }) {
  sound();
  confetti(big ? 260 : 140, big ? 4000 : 2600);
  openModal(`
    <div class="celebrate ${big ? 'big' : ''}">
      ${kid ? buddyHtml(kid, big ? 'proud' : 'excited', 'xl') : `<div class="celebrate-emoji">${emoji}</div>`}
      ${big ? `<div class="celebrate-emoji small">${emoji}</div>` : ''}
      <h1>${esc(title)}</h1>
      <p>${esc(text)}</p>
      <button class="btn huge" data-action="modal-close">Awesome!</button>
    </div>`, onClose);
}

/** Show any newly unlocked wardrobe items. Returns true if something was shown. */
function showUnlocks(kid) {
  if (!$modal.hidden) return false;
  if (showNewMoves(kid)) return true;
  const ids = newUnlocks(kid, progressFor(kid));
  if (!ids.length) return false;
  kid.seenUnlocks = [...(kid.seenUnlocks || []), ...ids];
  kid.newItems = [...(kid.newItems || []), ...ids];
  save();
  const items = ids.map(itemById);
  const preview = { ...kid.buddy, outfit: { ...kid.buddy.outfit, [items[0].slot]: items[0].id } };
  sounds.day();
  confetti(120, 2400);
  openModal(`
    <div class="celebrate">
      <div class="buddy buddy-xl mood-excited">${buddySvg(preview, 'excited')}</div>
      <h1>New stuff unlocked!</h1>
      <p>${items.map((i) => `<b>${esc(i.name)}</b>`).join(', ')}</p>
      <div class="stack">
        <button class="btn huge" data-action="unlock-try" data-slot="${items[0].slot}">Try it on!</button>
        <button class="btn ghost" data-action="modal-close">Later</button>
      </div>
    </div>`);
  return true;
}

/** Moves the kid's buddy just learned from the exercise streak (or from new gear). Shows the first one in action. */
function showNewMoves(kid) {
  const who = mover(kid);
  const seen = new Set(kid.seenMoves || []);
  const fresh = unlockedMoves(who.owned, who.exBest).filter((m) => !seen.has(m.move.id));
  if (!fresh.length) return false;
  kid.seenMoves = [...seen, ...fresh.map((m) => m.move.id)];
  save();
  const first = fresh[0];
  sounds.week();
  confetti(140, 2600);
  openModal(`
    <div class="celebrate">
      <button class="buddy-tap" data-action="buddy-move" data-kid="${kid.id}" data-move="${first.move.id}" aria-label="See the move again">${buddyHtml(kid, 'excited', 'xl')}</button>
      <h1>New move${fresh.length > 1 ? 's' : ''}!</h1>
      <p>${fresh.map((m) => `<b>${esc(m.move.name)}</b>`).join(', ')}</p>
      <p class="muted small">Best exercise streak: ${who.exBest} ${who.exBest === 1 ? 'week' : 'weeks'} 💪 Tap your buddy anytime to see a move.</p>
      <button class="btn huge" data-action="modal-close">Awesome!</button>
    </div>`, () => setTimeout(() => showUnlocks(kid), 250));
  setTimeout(() => { const el = $modal.querySelector('.buddy-tap'); if (el) doMove(el, who, first.move.id); }, 500);
  return true;
}

function celebrateIfDue(kid) {
  const t = today();
  const info = streakInfo(state, kid, t);
  const after = () => setTimeout(() => showUnlocks(kid), 250);
  if (!info.todayComplete) return showUnlocks(kid);
  const seen = state.celebrations[kid.id];
  if (seen?.day === t) return showUnlocks(kid);
  state.celebrations[kid.id] = { day: t, streak: info.streak };
  save();
  if (info.streak > 0 && info.streak % 7 === 0) {
    const weeks = info.streak / 7;
    celebrate({
      kid,
      onClose: after,
      emoji: '🏆',
      title: weeks === 1 ? 'A WHOLE WEEK!' : `${weeks} WEEKS IN A ROW!`,
      text: `${info.streak}-day streak! Your reward: ${state.settings.weeklyReward}. Show a parent!${info.freezes ? ' You also have a streak freeze ❄️ saved up.' : ''}`,
      sound: sounds.week,
      big: true,
    });
  } else {
    celebrate({
      kid,
      onClose: after,
      emoji: '🌟',
      title: 'Quest complete!',
      text: `Everything is done for today. Your streak is now ${info.streak} ${info.streak === 1 ? 'day' : 'days'} 🔥`,
      sound: sounds.day,
    });
  }
  return true;
}

// ---------- task actions ----------

function setTask(kid, key, task, value) {
  const entry = entryFor(state, kid.id, key, true);
  if (value === null) delete entry.tasks[task.id];
  else entry.tasks[task.id] = { ...(entry.tasks[task.id] || {}), ...value };
  save();
}

function markDone(kid, task, by, anchor) {
  setTask(kid, today(), task, { status: 'done', at: Date.now(), by });
  sounds.task();
  const { xp, coins, gems } = taskPay(state, kid, today(), task, today());
  floatText([gems && `+${gems} 💎`, xp && `+${xp} XP`, coins && `+${coins} 🪙`].filter(Boolean).join(' · ') || 'Done!', anchor);
  ui.cheerUntil = Date.now() + 2600;
  ui.cheerKid = kid.id;
  live(liveKey(kid)).cheer();
  render();
  setTimeout(() => celebrateIfDue(kid), 700);
  setTimeout(() => { if (ui.view === 'kid' && Date.now() >= ui.cheerUntil) render(); }, 2700);
}

function askParentNowOrLater(kid, task, anchor) {
  openModal(`
    <div class="center">
      <div class="big-emoji">${esc(task.icon)}</div>
      <h2>Nice work!</h2>
      <p>A parent needs to check <b>${esc(task.name)}</b>.</p>
      <div class="stack">
        <button class="btn huge" data-action="pin-now">Parent signs off now</button>
        <button class="btn ghost" data-action="pin-later">Ask a parent later</button>
      </div>
    </div>`);
  modalActions['pin-now'] = () => {
    closeModal();
    pinPad({ title: 'Parent sign-off', subtitle: `${kid.name}: ${task.name}`, onSuccess: () => markDone(kid, task, 'parent', anchor) });
  };
  modalActions['pin-later'] = () => {
    closeModal();
    setTask(kid, today(), task, { status: 'pending', at: Date.now() });
    sounds.pending();
    toast('Saved! A parent will check it.');
    render();
  };
}
const modalActions = {};

function onTaskTap(id, anchor) {
  const kid = kidById(ui.kidId);
  const t = today();
  const task = taskById(kid, t, id);
  if (!task) return;
  const status = entryFor(state, kid.id, t)?.tasks?.[id];
  if (status?.status === 'done') {
    toast('Already done! ⭐');
    return;
  }
  if (status?.status === 'pending') {
    askParentNowOrLater(kid, task, anchor);
    return;
  }
  if (task.minutes > 0 && (status?.seconds || 0) < task.minutes * 60) {
    ui.view = 'timer';
    ui.taskId = id;
    render();
    return;
  }
  if (task.verify === 'self') markDone(kid, task, 'self', anchor);
  else askParentNowOrLater(kid, task, anchor);
}

// ---------- practice timer ----------

// The timer counts from clock times (see practice.js). While it runs, the run is
// also kept in this device's storage, so if Android closes the app in the
// background, opening it again picks the timer back up.
const RUN_KEY = 'kidquest.practiceRun';
const timer = { running: false, interval: null, wakeLock: null, run: null };

function keepRun() {
  try {
    if (timer.run) localStorage.setItem(RUN_KEY, JSON.stringify(timer.run));
    else localStorage.removeItem(RUN_KEY);
  } catch { /* the timer still works while the app stays open */ }
}

async function grabWakeLock() {
  try {
    timer.wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    timer.wakeLock = null;
  }
}

function runTask() {
  const kid = kidById(timer.run?.kidId);
  const task = kid && taskById(kid, timer.run.day, timer.run.taskId);
  return kid && task && task.minutes > 0 ? { kid, task } : null;
}

function startTimer() {
  const kid = kidById(ui.kidId);
  const task = kid && taskById(kid, today(), ui.taskId);
  if (!task) return;
  const done = entryFor(state, kid.id, today())?.tasks?.[task.id]?.seconds || 0;
  timer.run = { kidId: kid.id, taskId: task.id, day: today(), since: Date.now(), base: done };
  keepRun();
  resumeTimer();
}

function resumeTimer() {
  timer.running = true;
  grabWakeLock();
  clearInterval(timer.interval);
  timer.interval = setInterval(tickTimer, 1000);
  render();
}

function stopTimer(rerender = true) {
  if (timer.run) syncTimer();
  timer.running = false;
  timer.run = null;
  keepRun();
  clearInterval(timer.interval);
  timer.interval = null;
  timer.wakeLock?.release?.().catch(() => {});
  timer.wakeLock = null;
  if (rerender && ui.view === 'timer') render();
}

// Bring the saved seconds up to the clock. Returns true when the timer is done.
function syncTimer() {
  const run = timer.run;
  const found = runTask();
  if (!found) return false;
  const { kid, task } = found;
  const total = task.minutes * 60;
  const now = Date.now();
  const entry = entryFor(state, kid.id, run.day, true);
  const cur = { status: 'inprogress', ...(entry.tasks[task.id] || {}) };
  const sec = Math.max(cur.seconds || 0, runSeconds(run, now, total));
  let changed = sec !== cur.seconds || !entry.tasks[task.id];
  if (run.awayFrom != null) {
    // count how much of the timer ran in another app, so a parent can see it
    const away = Math.max(0, sec - run.awayFrom);
    if (away) { cur.away = (cur.away || 0) + away; changed = true; }
    run.awayFrom = null;
    keepRun();
  }
  if (!changed) return sec >= total;
  cur.seconds = sec;
  entry.tasks[task.id] = cur;
  save();
  return sec >= total;
}

function tickTimer() {
  if (document.visibilityState !== 'visible' || !timer.run) return;
  const found = runTask();
  if (!found) return stopTimer();
  const { kid, task } = found;
  const finished = syncTimer();
  if (timer.run.day !== today()) {
    // midnight passed: yesterday's time stays with yesterday
    stopEars();
    stopTimer(false);
    if (ui.view === 'timer') { ui.view = 'kid'; render(); }
    return;
  }
  const total = task.minutes * 60;
  const sec = entryFor(state, kid.id, timer.run.day)?.tasks?.[task.id]?.seconds || 0;
  const $t = document.getElementById('timer-left');
  const $ring = document.getElementById('timer-ring');
  if ($t) $t.textContent = mmss(total - sec);
  if ($ring) $ring.style.setProperty('--p', sec / total);
  if (finished) finishTimer(kid, task);
}

function finishTimer(kid, task) {
  stopEars();
  stopTimer(false);
  sounds.day();
  confetti(80, 1800);
  ui.view = 'kid';
  ui.kidId = kid.id;
  render();
  if (task.verify === 'self') markDone(kid, task, 'self');
  else askParentNowOrLater(kid, task);
}

// Leaving the app: a task set to keep counting in other apps carries on (and
// remembers where it was, to show the parent the time spent away); any other
// timer pauses.
function leaveTimer() {
  if (!timer.running) return;
  const found = runTask();
  if (!found?.task.background) { stopTimer(); return; }
  syncTimer();
  timer.run.awayFrom = entryFor(state, found.kid.id, timer.run.day)?.tasks?.[found.task.id]?.seconds || 0;
  keepRun();
}

function returnToTimer() {
  if (!timer.running) return;
  grabWakeLock();
  tickTimer();
}

// The app was closed while a timer ran: pick it up again.
function restoreTimer() {
  let run = null;
  try { run = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch { run = null; }
  if (!run?.kidId || !run.taskId || !run.day || !run.since) return;
  timer.run = run;
  const found = runTask();
  if (!found || ui.view === 'setup') { timer.run = null; keepRun(); return; }
  if (run.day !== today()) { stopTimer(false); return; }
  if (syncTimer()) {
    // the time ran out while the app was closed
    setTimeout(() => finishTimer(found.kid, found.task), 300);
    return;
  }
  ui.view = 'timer';
  ui.kidId = run.kidId;
  ui.taskId = run.taskId;
  timer.running = true;
  grabWakeLock();
  timer.interval = setInterval(tickTimer, 1000);
}

document.addEventListener('visibilitychange', () => {
  // the microphone is only used while this screen is showing
  if (document.visibilityState !== 'visible') {
    const listening = !!(ears.run || ears.loading || listenTest.run);
    stopEars();
    leaveTimer();
    stopMusic();
    if (listenTest.run) stopListenTest();
    if (listening) render();
  }
  if (document.visibilityState === 'visible') { returnToTimer(); render(); startEars(); }
});

// The buddy on the timer page says a cheer when tapped.
let lastCheer = -1;
let cheerTimeout = 0;
function buddyCheer() {
  const kid = kidById(ui.kidId);
  const $b = document.querySelector('.timer-buddy');
  const $say = $b?.querySelector('.timer-bubble');
  if (!kid || !$say) return;
  lastCheer = pickCheer(lastCheer);
  if (!['head', 'silly'].includes($b.querySelector('canvas.live-buddy')?.dataset.zone)) live(liveKey(kid)).giggle();
  $say.textContent = CHEERS[lastCheer](kid.name);
  $b.classList.remove('hop');
  void $b.offsetWidth; // restart the hop
  $b.classList.add('talking', 'hop');
  $b.querySelector('.timer-sprite')?.addEventListener('animationend', () => $b.classList.remove('hop'), { once: true });
  sounds.tap();
  clearTimeout(cheerTimeout);
  cheerTimeout = setTimeout(() => $b.classList.remove('talking'), 4000);
}

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

// ---------- listening during practice ----------
// A timer task with "Listen to the piano" on listens while its timer runs and the
// timer page is on screen (listen.js; Google's recognizer decides what is piano).
// The buddy dances on the kid's beat (beat.js), or hops on notes when there is no
// beat. With no piano for 30 s it gets bored; after 60 s it falls asleep and the
// timer pauses, and playing again wakes it and the timer carries on. Without
// Google's recognizer (offline the first time) the buddy still dances, but it
// can't tell piano from talking, so it never falls asleep. Nothing is recorded.
const ears = { run: null, beat: null, side: 1, token: 0, loading: false, error: '', google: false, from: 0, mood: '', asleep: false, asleepAt: 0, woke: -Infinity, lastUi: 0 };
const EARS_NAP = 10 * 60_000;   // asleep this long: stop listening and let the screen turn off

/** The timer page's task, when it listens. */
function earsTask() {
  if (ui.view !== 'timer') return null;
  const kid = kidById(ui.kidId);
  const task = kid && taskById(kid, today(), ui.taskId);
  return task?.listen && task.minutes > 0 ? { kid, task } : null;
}

async function startEars() {
  if (ears.run || ears.loading || !earsTask() || !(timer.running || ears.asleep)) return;
  const token = ++ears.token;
  ears.error = '';
  ears.loading = true;
  updateEarsUi();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no mic'), { name: 'NoMic' });
    const recognizer = await loadRecognizer().catch(() => null);
    if (token !== ears.token || !earsTask() || !timer.running) return;
    const run = await startListening(onEarsFrame, { mode: 'google', recognizer });
    if (token !== ears.token || !earsTask() || !timer.running) { run.stop(); return; }
    Object.assign(ears, { run, beat: createBeatFollower(), google: run.listener.mode !== 'builtin', from: performance.now(), mood: '', asleep: false, woke: -Infinity });
  } catch (e) {
    if (token === ears.token) ears.error = e?.name === 'NotAllowedError' ? 'blocked' : e?.name === 'NotFoundError' || e?.name === 'NoMic' ? 'nomic' : 'other';
  } finally {
    if (token === ears.token) ears.loading = false;
    updateEarsUi();
  }
}

function stopEars() {
  ears.token++;
  ears.run?.stop();
  Object.assign(ears, { run: null, beat: null, loading: false, asleep: false, mood: '' });
}

/** The timer page's live buddy. */
function earsBuddy() {
  const kid = earsTask()?.kid;
  return kid ? live(liveKey(kid)) : null;
}

/** The kid tapped Start or Keep going: the quiet clock starts again. */
function wakeEars() {
  ears.asleep = false;
  ears.from = performance.now();
}

function onEarsFrame(listener, events, now) {
  if (ears.run?.listener !== listener) return;
  if (!earsTask() || (!timer.running && !ears.asleep)) { stopEars(); updateEarsUi(); return; }
  const $b = document.querySelector('.timer .timer-buddy');
  const beat = ears.beat;
  const builtin = listener.mode === 'builtin';
  const piano = pianoNow(listener, now);
  const dancing = piano && beat.following(now);
  for (const ev of events) {
    if (ev.type === 'onset') {
      beat.note(ev.at);
      if (!builtin && !dancing && piano && !ears.asleep) { buddyStep($b, 'hop'); earsBuddy()?.hop(); }
    } else if (ev.type === 'piano' && builtin && !dancing) { buddyStep($b, 'hop'); earsBuddy()?.hop(); }
  }
  if (beat.beats(now).length && piano && !ears.asleep) { danceBeat(ears, $b, document.getElementById('ears-metro'), beat.period); earsBuddy()?.beat(beat.period); }

  if (!ears.run.running) {
    // Chrome keeps the sound off until the screen is tapped (after the app reopened)
    ears.from = now;
  } else if (ears.asleep) {
    if (piano) {
      // playing again wakes the buddy, and the timer carries on
      Object.assign(ears, { asleep: false, woke: now, from: now, mood: 'playing' });
      earsBuddy()?.surprise();
      startTimer();
      updateEarsUi(now);
      return;
    }
    if (now - ears.asleepAt > EARS_NAP) { stopEars(); timer.wakeLock?.release?.().catch(() => {}); timer.wakeLock = null; render(); return; }
  }
  // seconds with no piano, counted from when listening (or the timer) last started
  const since = Math.min(listener.since(now), (now - ears.from) / 1000);
  ears.mood = ears.asleep ? 'asleep'
    : ears.google ? buddyState(since, listener.state.lastPiano != null)
      : piano ? 'playing' : 'waiting';
  if (ears.mood === 'asleep' && !ears.asleep && timer.running) {
    // a minute with no piano: the buddy falls asleep and the timer pauses (still
    // listening, with the screen on, so playing wakes it)
    ears.asleep = true;
    ears.asleepAt = now;
    stopTimer(false);
    grabWakeLock();
    render();
    updateEarsUi(now);
    return;
  }
  if (now - ears.lastUi > 100) { ears.lastUi = now; updateEarsUi(now); }
}

/**
 * How the timer page's buddy feels: listening for the piano, swaying to playing
 * with no steady beat, dancing (and humming) on the kid's beat, bored, asleep.
 */
function timerFeel(mood, dancing = false) {
  if (mood === 'playing') return dancing ? { valence: 0.95, arousal: 0.9, dance: 1, sing: 0.6, notes: true } : { valence: 0.85, arousal: 0.6, listen: 1 };
  if (mood === 'waiting') return { valence: 0.5, arousal: 0.5, curious: 0.35 };
  if (mood === 'bored') return { valence: -0.3, arousal: 0.2, sleep: 0.3 };
  if (mood === 'asleep') return { valence: 0.1, arousal: 0.1, sleep: 1 };
  return timer.running ? { valence: 0.75, arousal: 0.6 } : { valence: 0.6, arousal: 0.5 };
}

/** The line under the buddy: what it hears. */
function earsText(now = performance.now()) {
  if (ears.error === 'blocked') return 'I can’t hear you: the microphone is blocked. Ask a parent.';
  if (ears.error === 'nomic') return 'I can’t hear you: no microphone was found.';
  if (ears.error) return 'I can’t hear you right now. Try Pause, then Keep going.';
  if (ears.asleep) return 'Asleep… play to wake me up!';
  if (ears.loading) return 'Getting my ears ready…';
  const listener = ears.run?.listener;
  if (!listener) return timer.running ? 'Getting my ears ready…' : 'Start, then play. I’ll dance to your beat!';
  if (!ears.run.running) return 'Tap the screen so I can hear you!';
  const piano = pianoNow(listener, now);
  if (piano && ears.beat.following(now)) return `Dancing to your beat! About ${ears.beat.bpm} a minute`;
  return piano ? 'Playing! No steady beat yet (that’s ok)' : 'Listening for the piano…';
}

function updateEarsUi(now = performance.now()) {
  const $text = document.getElementById('ears-text');
  if (!$text) return;
  const text = earsText(now);
  if ($text.textContent !== text) $text.textContent = text;
  const listener = ears.run?.listener;
  const $b = document.querySelector('.timer .timer-buddy');
  if (!(listener && pianoNow(listener, now) && ears.beat.following(now))) danceRest($b, document.getElementById('ears-metro'));
  const kid = earsTask()?.kid;
  const $sprite = $b?.querySelector('.timer-sprite');
  if (!$sprite || !kid) return;
  // the page keeps what it shows (a redraw may leave it be), so compare with the page
  const mood = ears.run || ears.asleep ? ears.mood || 'waiting' : '';
  if (mood !== $sprite.dataset.mood) $sprite.dataset.mood = mood;
  feel(liveKey(kid), timerFeel(mood, Boolean(listener && pianoNow(listener, now) && ears.beat.following(now))));
  // what it says (a cheer from a tap stays until it fades)
  const say = now - ears.woke < 2500 ? 'I’m up! Timer back on.' : LISTEN_SAY[mood] || '';
  const $say = $b.querySelector('.timer-bubble');
  const mine = $say.dataset.ears || '';
  if (say && (say !== mine || !$b.classList.contains('talking'))) { $say.textContent = say; $b.classList.add('talking'); }
  else if (!say && mine && $say.textContent === mine) $b.classList.remove('talking');
  $say.dataset.ears = say;
}

// ---------- views ----------

function kidSummary(kid) {
  const t = today();
  const s = dayStatus(state, kid, t, t);
  const info = streakInfo(state, kid, t);
  return { s, info };
}

function viewSetup() {
  return `
    <div class="screen center setup">
      <div class="logo">⭐</div>
      <h1>Welcome to Kid Quest</h1>
      <p>Daily quests for chores and piano, with streaks and celebrations.</p>
      <p class="muted">First, choose a 4-digit parent PIN. Kids will need a parent to type it to sign off tasks and change settings.</p>
      <button class="btn huge" data-action="setup-pin">Choose parent PIN</button>
      <p class="muted small">Already set up Kid Quest on another device?</p>
      <button class="btn ghost" data-action="family-join">Join your family with a code</button>
    </div>`;
}

function viewHome() {
  const cards = state.kids.map((kid) => {
    const { s, info } = kidSummary(kid);
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 100;
    return `
      <button class="kid-card" data-action="open-kid" data-id="${kid.id}" style="--kid:${kid.color}">
        ${buddyHtml(kid, moodFor(kid), 'md', { live: true })}
        <div class="kid-name">${esc(kid.name)}</div>
        <div class="streak ${info.streak ? '' : 'cold'}">🔥 ${info.streak}</div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div class="muted">${s.complete ? 'Quest complete! 🌟' : `${s.done} of ${s.total} done`}</div>
      </button>`;
  }).join('');
  return `
    <div class="screen">
      <header class="top">
        <h1>Kid Quest</h1>
        <div class="muted">${esc(parseKey(today()).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))}</div>
      </header>
      ${state.kids.length ? `<div class="kid-grid">${cards}</div>` : `
        <div class="empty">
          <p>No kids yet. A parent needs to add them.</p>
        </div>`}
      <footer class="bottom">
        <button class="btn ghost" data-action="parent">🔒 Parents${pendingApprovals(state, today()).length ? ` <span class="badge">${pendingApprovals(state, today()).length}</span>` : ''}</button>
      </footer>
    </div>`;
}

function weekDots(kid, info) {
  const t = today();
  const dow = parseKey(t).getDay();
  const monday = addDays(t, -((dow + 6) % 7));
  const frozen = new Set(info.frozen);
  const cells = [];
  for (let i = 0; i < 7; i += 1) {
    const key = addDays(monday, i);
    const label = DAY_NAMES[parseKey(key).getDay()][0];
    let cls = 'future';
    let mark = '';
    if (key <= t && (!kid.startDate || key >= kid.startDate)) {
      const s = dayStatus(state, kid, key, t);
      if (s.complete) { cls = 'done'; mark = '✓'; } else if (key === t) { cls = 'today'; } else if (frozen.has(key)) { cls = 'frozen'; mark = '❄'; } else if (s.excused) { cls = 'excused'; mark = '💤'; } else { cls = 'missed'; mark = '·'; }
    }
    cells.push(`<div class="dot ${cls}"><span>${mark}</span><small>${label}</small></div>`);
  }
  return `<div class="week">${cells.join('')}</div>`;
}

function taskTile(kid, task, status) {
  const st = status?.status;
  const timerTask = task.minutes > 0;
  let state_ = 'todo';
  let sub = task.verify === 'parent' ? 'Parent checks' : 'Tap when done';
  if (st === 'done') { state_ = 'done'; sub = 'Done!'; } else if (st === 'pending') { state_ = 'pending'; sub = 'Waiting for a parent'; } else if (timerTask) {
    const left = task.minutes * 60 - (status?.seconds || 0);
    sub = left <= 0 ? 'Time done! Get a parent' : status?.seconds ? `${mmss(left)} left` : `${task.minutes} minute timer`;
  }
  return `
    <button class="tile ${state_}" data-action="task" data-id="${task.id}">
      <span class="tile-icon">${esc(task.icon)}</span>
      <span class="tile-text"><b>${esc(task.name)}</b><small>${esc(sub)}</small></span>
      <span class="tile-check">${st === 'done' ? '✓' : st === 'pending' ? '⏳' : ''}</span>
    </button>`;
}

// Board-game path: one stop per task, winding down the screen, ending at a treasure chest.
const MAP_ROW = 124;
const VILLAGE = 150; // extra room at the top of the map when buddies are visiting

// Everyone in the family who has a buddy: this device's kids plus, on a kid's
// device, the others from the cloud.
function familyBuddies() {
  const all = new Map((family.buddies || []).map((b) => [b.id, b]));
  for (const k of state.kids) all.set(k.id, { id: k.id, name: k.name, color: k.color, buddy: k.buddy, owned: k.owned || [], exBest: mover(k).exBest });
  return [...all.values()];
}

const visitorsArrived = new Set();

function visitorsHtml(kid, s) {
  const visitors = pickVisitors(kid.id, familyBuddies(), today());
  if (!visitors.length) return { html: '', room: 0, areas: '' };
  const lines = visitorLines(visitors, { name: kid.name, streak: streakInfo(state, kid, today()).streak, complete: s.complete }, today());
  // stand in front of the village houses (see paintOne in maparts.js): an outer and an inner spot each side
  const wide = ($app.clientWidth || window.innerWidth) > 600;
  const X = wide ? { left: [20, 33], right: [80, 67] } : { left: [22, 37], right: [78, 63] };
  // players stand at the two ends of their field (see pondSpots in maparts.js)
  const GX = wide ? { left: [16, 42], right: [84, 58] } : { left: [16, 41], right: [84, 59] };
  const gearOf = (v) => bestGear(v.owned);
  const plan = planVisits(kid.id, visitors.map((v) => ({ id: v.id, gear: gearOf(v) })), today());
  const areaOf = (id) => plan.areas.find((a) => a.members.includes(id));
  const version = (tier) => ['regular', 'good', 'super'][tier - 1];
  const html = visitors.map((v, i) => {
    const spot = plan.spots[v.id];
    const area = areaOf(v.id);
    const x = (area && area.kind !== 'pond' ? GX : X)[spot.side][spot.slot];
    const gear = gearOf(v);
    let look = v.buddy;
    let cls = '';
    let extra = '';
    let data = '';
    if (area?.kind === 'pond') {
      // fishing in the village pond, facing away from the road
      look = { ...v.buddy, outfit: { ...v.buddy.outfit, music: undefined, sport: `sport-rod-${version(gear.rod)}` } };
      cls = `fishing face-${spot.side}`;
      data = `data-rod="${gear.rod}"`;
      extra = '<div class="fish-line" aria-hidden="true"><span class="bobber"></span></div><div class="fish-catch" aria-hidden="true"></div>';
    } else if (area) {
      // playing a game: the one nearer the left edge is player a. Sticks are held, balls are shared.
      const a = x === Math.min(...area.members.map((id) => GX[plan.spots[id].side][plan.spots[id].slot]));
      const outfit = { ...v.buddy.outfit, music: undefined, sport: area.kind === 'hockey' ? `sport-hockey-${version(gear.hockey)}` : undefined };
      look = { ...v.buddy, outfit };
      cls = `playing play-${area.kind} player-${a ? 'a' : 'b'} ${a && area.kind === 'hockey' ? 'face-left' : ''}`;
    }
    return `
      <div class="map-visitor ${i === 0 ? 'talking' : ''} ${spot.slot ? 'inner' : ''} ${x < 20 ? 'edge-left' : x > 80 ? 'edge-right' : ''} ${cls}" data-action="visitor" data-id="${esc(v.id)}" ${data} style="left:${x}%;--kid:${esc(v.color || '#4dabf7')}">
        <div class="visitor-buddy">${buddySvg(look, 'happy', { background: false })}</div>
        ${extra}
        <div class="visitor-name">${esc(v.name)}</div>
        <div class="visitor-bubble">${esc(lines[i])}</div>
      </div>`;
  }).join('');
  // the ball (or puck) goes back and forth between the two players
  const games = plan.areas.filter((a) => a.kind !== 'pond').map((a) => {
    const xs = a.members.map((id) => GX[plan.spots[id].side][plan.spots[id].slot]).sort((p, q) => p - q);
    const tier = Math.max(...a.members.map((id) => gearOf(visitors.find((v) => v.id === id))[a.kind] || 1));
    return `<div class="map-game game-${a.kind}" style="left:${xs[0]}%;width:${xs[1] - xs[0]}%" aria-hidden="true"><span class="game-ball">${ballSvg(a.kind, tier)}</span></div>`;
  }).join('');
  const areas = plan.areas.map((a) => `${a.side}:${a.kind}`).join(',');
  // they walk in once a day per kid; later redraws show them already there
  const key = `${kid.id}|${today()}`;
  const arrive = !visitorsArrived.has(key);
  visitorsArrived.add(key);
  return { html: `<div class="map-visitors ${arrive ? 'arrive' : ''}" data-host="${esc(kid.id)}" aria-label="Visiting buddies">${games}${html}</div>`, room: VILLAGE, areas };
}
/** The map theme follows the kid's Places background. */
const kidTheme = (kid) => kid.buddy?.outfit?.background || 'bg-meadow';
const MAP_WAVE = [0, 22, 30, 18, -4, -24, -30, -16];

function questMap(kid, s, entry, mood) {
  const rows = [];
  const add = (period, label) => {
    const tasks = s.tasks.filter((x) => x.period === period);
    if (!tasks.length) return;
    rows.push({ type: 'sign', label });
    for (const t of tasks) rows.push({ type: 'task', task: t, status: entry?.tasks?.[t.id]?.status });
  };
  add('morning', `🌅 Morning · by ${formatTime(state.settings.morningBy)}`);
  add('afternoon', `☀️ After school · by ${formatTime(state.settings.bedtime)}`);
  rows.push({ type: 'chest' });

  // where the buddy stands: the first task not done or waiting; the chest when all are
  let here = rows.findIndex((r) => r.type === 'task' && r.status !== 'done' && r.status !== 'pending');
  if (here < 0) here = rows.length - 1;

  const visit = visitorsHtml(kid, s);
  const top = 70 + visit.room;
  const pts = rows.map((r, i) => ({ x: 50 + (r.type === 'task' || r.type === 'chest' ? MAP_WAVE[i % MAP_WAVE.length] : 0), y: top + i * MAP_ROW }));
  const height = top + rows.length * MAP_ROW;
  // the river runs just above the after-school sign, so crossing the bridge means school's out
  const pmSign = rows.findIndex((r, i) => i > 0 && r.type === 'sign');
  const riverY = pmSign > 0 ? pts[pmSign].y - 42 : '';
  const mapData = esc(JSON.stringify(pts.map((p, i) => [p.x, p.y, rows[i].type])));

  // keep labels inside the map: the space on the label's side, minus the node
  const labelWidth = (x) => `max-width:min(240px, calc(${x > 50 ? x : 100 - x}% - 66px))`;
  const nodes = rows.map((r, i) => {
    const p = pts[i];
    const pos = `left:${p.x}%;top:${p.y}px`;
    if (r.type === 'sign') return `<div class="map-sign" style="${pos}">${esc(r.label)}</div>`;
    if (r.type === 'chest') {
      return `<button class="map-node chest ${s.complete ? 'open' : ''}" style="${pos}" data-action="chest" aria-label="Treasure">
          <span class="node-icon">${s.complete ? '🏆' : '🎁'}</span></button>
        <div class="map-label ${p.x > 50 ? 'left' : 'right'}" style="${pos};${labelWidth(p.x)}"><b>${s.complete ? 'Quest complete!' : 'Treasure!'}</b><small>${s.complete ? 'See you tomorrow' : 'Finish every task'}</small></div>`;
    }
    const t = r.task;
    const st = r.status === 'done' ? 'done' : r.status === 'pending' ? 'pending' : i === here ? 'current' : 'todo';
    let sub = st === 'done' ? 'Done!' : st === 'pending' ? 'Waiting for a parent' : t.verify === 'parent' ? 'Parent checks' : 'Tap when done';
    if (st !== 'done' && st !== 'pending' && t.minutes > 0) {
      const sec = entry?.tasks?.[t.id]?.seconds || 0;
      const left = t.minutes * 60 - sec;
      sub = left <= 0 ? 'Time done! Get a parent' : sec ? `${mmss(left)} left` : `${t.minutes} minute timer`;
    }
    return `<button class="map-node ${st}" style="${pos}" data-action="task" data-id="${t.id}" aria-label="${esc(t.name)}">
        <span class="node-icon">${esc(t.icon)}</span>
        ${st === 'done' ? '<span class="node-badge">✓</span>' : st === 'pending' ? '<span class="node-badge wait">⏳</span>' : ''}
      </button>
      <div class="map-label ${p.x > 50 ? 'left' : 'right'}" style="${pos};${labelWidth(p.x)}"><b>${esc(t.name)}</b><small>${esc(sub)}</small></div>`;
  }).join('');

  const hp = pts[here];
  const walker = `<div class="map-buddy ${mood === 'excited' ? 'hop' : ''}" style="left:${hp.x}%;top:${hp.y}px" data-action="buddy-move" data-kid="${kid.id}">
      ${buddyHtml(kid, mood, 'mini', { background: false, live: true, idle: true })}
    </div>`;

  return `
    <section class="quest-map" style="height:${height}px;background:${mapTheme(kidTheme(kid)).ground[0]}" data-theme="${esc(kidTheme(kid))}" data-pts="${mapData}" data-here="${here}" data-river="${riverY}" data-areas="${esc(visit.areas)}" data-seed="${esc(kid.id)}">
      <canvas class="map-land" aria-hidden="true"></canvas>
      <div class="map-start" style="left:50%;top:0">🚩 Start</div>
      ${visit.html}
      ${nodes}
      ${walker}
    </section>`;
}

function viewKid() {
  const kid = kidById(ui.kidId);
  if (!kid) { ui.view = 'home'; return viewHome(); }
  const t = today();
  snapshotToday(state, kid, t);
  save();
  const { s, info } = kidSummary(kid);
  const xp = totalXp(state, kid, t);
  const lv = levelFor(xp);
  const entry = entryFor(state, kid.id, t);
  const section = (period, title, by) => {
    const tasks = s.tasks.filter((x) => x.period === period);
    if (!tasks.length) return '';
    return `
      <section>
        <h2>${title} <small class="muted">${by ? `by ${esc(formatTime(by))}` : ''}</small></h2>
        <div class="tiles">${tasks.map((x) => taskTile(kid, x, entry?.tasks?.[x.id])).join('')}</div>
      </section>`;
  };
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 100;
  const mood = moodFor(kid);
  const listMode = state.settings.questView === 'list';
  const newCount = (kid.newItems || []).length;
  const exTasks = tasksForDay(state, kid, t, t).filter(isExercise);
  return `
    <div class="screen kid" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="home" aria-label="Back">←</button>
        <div class="kid-title"><b>${esc(kid.name)}</b><small>Level ${lv.level} · <span class="xpbar"><span style="width:${lv.into}%"></span></span></small></div>
        <div class="chips">
          <span class="chip fire ${info.streak ? '' : 'cold'}" title="Streak">🔥 ${info.streak}</span>
          <span class="chip ice" title="Streak freezes">❄️ ${info.freezes}</span>
          <span class="chip coin" title="Coins">🪙 ${Math.max(0, totalCoins(state, kid, t) - (kid.spent || 0))}</span>
          ${exTasks.length || kid.gemsSpent ? `<span class="chip gem" title="Gems">💎 ${Math.max(0, totalGems(state, kid, t) - (kid.gemsSpent || 0))}</span>` : ''}
        </div>
      </header>
      <div class="buddy-panel">
        <button class="buddy-tap" data-action="buddy-move" data-kid="${kid.id}" aria-label="Tap ${esc(kid.name)}'s buddy">${buddyHtml(kid, mood, 'lg', { live: true, idle: true })}</button>
        <div class="buddy-side">
          <div class="bubble">${esc(buddyLine(mood, kid.name))}</div>
          <div class="quest-progress">
            <div class="bar big"><span style="width:${pct}%"></span></div>
            <div>${s.complete ? '<b>Quest complete! 🌟</b>' : `<b>${s.done} of ${s.total}</b> done${s.pending ? ` · ${s.pending} waiting for a parent` : ''}`}</div>
          </div>
          <button class="btn ghost" data-action="wardrobe">👕 Dress up ${esc(kid.name)}'s buddy${newCount ? ` <span class="badge">new</span>` : ''}</button>
        </div>
      </div>
      ${exerciseSection(kid, exTasks, entry)}
      <div class="view-toggle">
        <button class="${listMode ? '' : 'on'}" data-action="quest-mode" data-mode="map">🗺️ Map</button>
        <button class="${listMode ? 'on' : ''}" data-action="quest-mode" data-mode="list">📋 List</button>
      </div>
      ${listMode || !state.settings.sound ? '' : `<button class="btn ghost round music-toggle" data-action="music-toggle" aria-label="${state.settings.music === false ? 'Turn music on' : 'Turn music off'}">${state.settings.music === false ? '🔇' : '🎵'}</button>`}
      ${listMode ? `${section('morning', '🌅 Morning', state.settings.morningBy)}
      ${section('afternoon', '☀️ After school', state.settings.bedtime)}` : questMap(kid, s, entry, mood)}
      <section>
        <h2>This week</h2>
        ${weekDots(kid, info)}
        ${weekCoinsHtml(kid)}
        <p class="muted small">Finish 7 days in a row to earn a streak freeze ❄️ (you can save up to 2). A freeze protects your streak if you miss a day. Best streak: ${info.best} days.</p>
      </section>
    </div>`;
}

/** "🪙 120 of 300 this week", and any bonuses a parent gave. */
function weekCoinsHtml(kid) {
  const w = weekEarnings(state, kid, today());
  if (!w.allowance && !w.bonuses.length) return '';
  const pct = w.allowance?.coins ? Math.min(100, Math.round((w.coins / w.allowance.coins) * 100)) : 0;
  return `
        <div class="week-coins">
          ${w.allowance ? `<div class="row"><b>🪙 ${w.coins} of ${w.allowance.coins} this week</b></div><div class="bar coin-bar"><span style="width:${pct}%"></span></div>` : ''}
          ${w.bonuses.map((b) => `<div class="bonus-line">🎁 <b>+${b.coins}</b> ${esc(b.reason || 'Bonus')} <small class="muted">from ${esc(b.by || 'a parent')}</small></div>`).join('')}
        </div>`;
}

/** Bonus exercise: optional tiles that earn gems, and how the exercise week is going. */
function exerciseSection(kid, tasks, entry) {
  if (!tasks.length) return '';
  const ex = exerciseInfo(kid);
  const dots = Array.from({ length: ex.goal }, (_, i) => `<span class="ex-dot ${i < ex.thisWeek ? 'on' : ''}">${i < ex.thisWeek ? '💪' : ''}</span>`).join('');
  const streak = ex.weeks ? `${ex.weeks}-week exercise streak 🔥` : 'Exercise 5 days this week to start a streak';
  return `
      <section class="exercise">
        <h2>💪 Bonus exercise <small class="muted">earns 💎 gems</small></h2>
        <div class="ex-week"><div class="ex-dots" aria-label="${ex.thisWeek} of ${ex.goal} exercise days this week">${dots}</div><small>${ex.thisWeek >= ex.goal ? '<b>This week counts!</b> ' : `${ex.thisWeek} of ${ex.goal} days this week · `}${esc(streak)}</small></div>
        <div class="tiles">${tasks.map((x) => taskTile(kid, x, entry?.tasks?.[x.id])).join('')}</div>
      </section>`;
}

function viewTimer() {
  const kid = kidById(ui.kidId);
  const task = kid && taskById(kid, today(), ui.taskId);
  if (!task) { ui.view = 'kid'; return viewKid(); }
  const done = entryFor(state, kid.id, today())?.tasks?.[task.id]?.seconds || 0;
  const total = task.minutes * 60;
  const naps = 'If the piano stops for a minute, it falls asleep and the timer pauses until you play again.';
  const tip = task.background
    ? `You can switch to another app, like Note Rush. The timer keeps counting. Come back here when you’re done.${task.listen ? ` On this screen your buddy listens and dances to your beat. ${naps}` : ''}`
    : task.listen
      ? `Keep the tablet on the piano with this screen open. Your buddy listens and dances to your beat. ${naps} The timer also pauses if you leave the app.`
      : 'Keep the tablet near the piano with this screen open. The timer pauses if you leave the app.';
  const mood = task.listen && (ears.run || ears.asleep) ? ears.mood || 'waiting' : '';
  return `
    <div class="screen timer center" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="timer-back" aria-label="Back">←</button>
        <div class="kid-title"><b>${esc(task.icon)} ${esc(task.name)}</b><small>${esc(kid.name)}</small></div>
      </header>
      <div class="timer-stage">
        <div class="ring" id="timer-ring" style="--p:${done / total}">
          <div class="ring-inner">
            <div class="timer-left" id="timer-left">${mmss(total - done)}</div>
            <small>${timer.running ? 'Keep playing! 🎶' : ears.asleep ? 'Asleep 💤' : done ? 'Paused' : 'Ready?'}</small>
          </div>
        </div>
        <button class="timer-buddy live" data-action="timer-buddy" aria-label="Tap ${esc(kid.name)}'s buddy for a cheer">
          <span class="timer-bubble" aria-live="polite"></span>
          <span class="timer-sprite" data-mood="${mood}">${liveHtml(liveKey(kid), kid.buddy, { background: false, feel: timerFeel(mood), idle: false, label: `${kid.name}'s buddy` })}</span>
        </button>
      </div>
      ${task.listen ? `<div class="timer-beat" id="ears">
        <div class="listen-metro" id="ears-metro" aria-hidden="true"><i></i></div>
        <b id="ears-text" aria-live="polite">${esc(earsText())}</b>
      </div>` : ''}
      <button class="btn huge" data-action="${timer.running ? 'timer-pause' : 'timer-start'}">${timer.running ? 'Pause' : done ? 'Keep going' : 'Start practice'}</button>
      <p class="muted small">${tip}</p>
    </div>`;
}

// ---------- piano listening test (parents) ----------
// A test page to see how well the tablet hears piano playing, before the timer
// uses it. It shows what the engine in listen.js hears, live. A switch picks who
// decides what is piano: the built-in engine, Google's recognizer, or both.
// Every new sound also goes to the beat follower (beat.js): while piano is playing
// and it finds a beat, the buddy dances on it and a little metronome swings along.
const listenTest = { run: null, events: [], error: '', settings: null, lastUi: 0, woke: 0, loading: false, beat: null, side: 1 };
const LISTEN_MODE_KEY = 'kidquest.listenMode';
const LISTEN_MODES = [['builtin', 'Built-in'], ['google', 'Google'], ['both', 'Both agree']];
function listenMode() {
  if (!ui.listenMode) {
    try { ui.listenMode = localStorage.getItem(LISTEN_MODE_KEY); } catch { /* private window */ }
    if (!LISTEN_MODES.some(([m]) => m === ui.listenMode)) ui.listenMode = 'google';
  }
  return ui.listenMode;
}
let lastListenMood = '';
const LISTEN_MOODS = { playing: 'excited', waiting: 'happy', bored: 'sad', asleep: 'sleepy' };
const LISTEN_LABELS = { playing: '🎹 Hearing piano', waiting: '👂 Listening…', bored: '😐 Bored (no piano for 30 s)', asleep: '😴 Asleep (the timer would pause)' };
const LISTEN_SAY = { bored: 'I’m bored… play something!', asleep: 'Zzz…' };
const LISTEN_BEAT = { none: 'Listening for a beat', free: 'No steady beat (that’s ok)' };

function viewListen() {
  const kid = kidById(ui.listenKid) || state.kids[0];
  const buddy = kid?.buddy || { species: 'fox', outfit: {} };
  const on = !!listenTest.run;
  const mode = listenMode();
  lastListenMood = '';
  return `
    <div class="screen listen">
      <header class="top row">
        <button class="btn ghost round" data-action="listen-back" aria-label="Back">←</button>
        <h1 class="grow">Piano listening test</h1>
      </header>
      ${state.kids.length > 1 ? `<div class="row wrap listen-kids">${state.kids.map((k) => `<button class="btn ${k.id === kid?.id ? '' : 'ghost'}" data-action="listen-kid" data-id="${k.id}">${esc(k.name)}</button>`).join('')}</div>` : ''}
      <div class="listen-stage">
        <button class="timer-buddy listen-buddy" aria-label="Buddy">
          <span class="timer-bubble" id="ls-say" aria-live="polite"></span>
          <span class="timer-sprite" id="ls-sprite">${buddySvg(buddy, 'happy', { background: false })}</span>
        </button>
        <div class="listen-status">
          <b id="ls-state">${on ? LISTEN_LABELS.waiting : 'Not listening'}</b>
          <div class="listen-clock"><span id="ls-since">–</span> s since the last piano note</div>
          <div class="listen-bar" aria-hidden="true"><i id="ls-since-bar"></i><em style="left:50%"></em><em style="left:100%"></em></div>
          <small class="muted">Bored at ${TUNING.boredAfter} s · asleep at ${TUNING.asleepAfter} s</small>
          <div class="listen-beat">
            <div class="listen-metro" id="ls-metro" aria-hidden="true"><i id="ls-arm"></i></div>
            <div><b id="ls-beat">${on ? LISTEN_BEAT.none : '–'}</b><small class="muted">The buddy dances when it finds your beat</small></div>
          </div>
        </div>
      </div>
      <div class="listen-modes" role="group" aria-label="Who decides what is piano">
        <span class="muted small">Who decides:</span>
        ${LISTEN_MODES.map(([m, label]) => `<button class="btn ${m === mode ? '' : 'ghost'}" data-action="listen-mode" data-mode="${m}" aria-pressed="${m === mode}">${label}</button>`).join('')}
      </div>
      <div class="listen-actions">
        ${listenTest.loading ? '<p class="muted">Loading Google’s sound recognizer (about 25 MB the first time)…</p>'
    : `<button class="btn huge" data-action="${on ? 'listen-stop' : 'listen-start'}">${on ? 'Stop listening' : 'Start listening'}</button>`}
      </div>
      ${listenTest.error ? `<p class="listen-error">${esc(listenTest.error)}</p>` : ''}
      <div class="card listen-live">
        <div class="listen-row"><span>Loudness</span><div class="listen-meter"><i id="ls-level"></i><em id="ls-gate"></em></div></div>
        <div class="listen-row"><span>Last sound</span><b id="ls-last">–</b></div>
        ${mode === 'builtin' ? '' : `<div class="listen-row"><span>Google hears</span><b id="ls-google">–</b></div>
        <div class="listen-row"><span>Piano score</span><div class="listen-meter"><i id="ls-gpiano"></i><em style="left:${TUNING.googlePiano * 100}%"></em></div></div>`}
        <div class="listen-row"><span>Piano notes</span><b id="ls-piano">0</b></div>
        <div class="listen-row"><span>Other sounds</span><b id="ls-other">0</b></div>
        <div class="listen-row"><span>Last 60 s</span><div class="listen-line" id="ls-line"></div></div>
        <small class="muted"><span class="dot piano"></span> piano &nbsp; <span class="dot other"></span> talking or other noise</small>
        <p class="muted small" id="ls-mic">${listenTest.settings ? micNote(listenTest.settings) : ''}</p>
      </div>
      <div class="card">
        <h2>Things to try</h2>
        <ol class="small listen-tries">
          <li>Put the tablet on the piano, where it sits during practice, and tap Start.</li>
          <li>Try each “Who decides” choice: Built-in hears each note at once, Google knows piano from voices best but decides about half a second later, and Both agree counts a note only when both say piano.</li>
          <li>Play slowly, then fast, then chords. Each note should add a green dot and make the buddy hop.</li>
          <li>Play a song with a steady beat. After a few notes the buddy should dance on the beat and the metronome should swing with you, sometimes on every other beat. Speed up, slow down, switch songs, or stop for a moment, and see how fast it follows.</li>
          <li>Noodle around with no beat. The buddy should hop on your notes but not dance (that’s fine).</li>
          <li>Stop playing and talk near the tablet. Talking should add orange dots and not reset the clock.</li>
          <li>Have a kid practice while others talk in the room.</li>
          <li>Stop for 30 seconds (bored), then 60 (asleep), then play one note to wake the buddy.</li>
          <li>Try very soft playing.</li>
        </ol>
        <p class="muted small">Nothing is recorded or saved. Google’s recognizer runs on this tablet too: only the recognizer itself downloads, the sound never leaves the tablet. Listening stops when you leave this page or the app.</p>
      </div>
    </div>`;
}

function micNote(st) {
  const on = ['echoCancellation', 'noiseSuppression', 'autoGainControl'].filter((k) => st[k] === true);
  return on.length
    ? `⚠️ Chrome kept these voice filters on: ${on.join(', ')}. They can hide held piano notes.`
    : `Mic ready, voice filters off${st.sampleRate ? ` · ${st.sampleRate} Hz` : ''}.`;
}

async function startListenTest() {
  if (listenTest.run) return;
  listenTest.error = '';
  listenTest.events = [];
  listenTest.beat = createBeatFollower();
  const mode = listenMode();
  let recognizer = null;
  if (mode !== 'builtin') {
    listenTest.loading = true;
    render();
    try {
      recognizer = await loadRecognizer();
    } catch (e) {
      listenTest.error = `Couldn’t load Google’s recognizer, so the built-in one is listening. It needs the internet the first time. (${e?.message || e})`;
    }
    listenTest.loading = false;
    if (ui.view !== 'listen') return;
  }
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no mic'), { name: 'NoMic' });
    listenTest.run = await startListening(onListenFrame, { mode, recognizer });
    listenTest.settings = { ...listenTest.run.settings, sampleRate: listenTest.run.sampleRate };
    grabWakeLock();
  } catch (e) {
    listenTest.run = null;
    listenTest.error = e?.name === 'NotAllowedError'
      ? 'The microphone is blocked. In Chrome, tap the icon left of the web address, then Permissions, and allow the microphone.'
      : e?.name === 'NotFoundError' || e?.name === 'NoMic' ? 'No microphone was found on this device.'
        : `Could not start the microphone (${e?.message || e}).`;
  }
  render();
}

function stopListenTest() {
  listenTest.run?.stop();
  listenTest.run = null;
  if (!timer.running) { timer.wakeLock?.release?.().catch(() => {}); timer.wakeLock = null; }
}

/** Piano is playing now: Google heard piano in the last moment (or, built-in, a piano note did). */
function pianoNow(listener, now) {
  if (listener.mode !== 'builtin') return listener.hearingPiano(now);
  return listener.state.lastPiano != null && now - listener.state.lastPiano < 1500;
}

/** Restarts one of a buddy's moves: a hop on a note, or a dance step on a beat. */
function buddyStep($b, cls, ms) {
  if (!$b) return;
  $b.classList.remove('hop', 'dance-l', 'dance-r');
  void $b.offsetWidth;
  if (ms) $b.style.setProperty('--move', `${Math.round(ms)}ms`);
  $b.classList.add(cls);
}

/**
 * A beat (p ms long): the buddy steps to the other side, and the metronome ticks
 * and swings over. st keeps which side it is on.
 */
function danceBeat(st, $b, $m, p) {
  st.side = -(st.side || 1);
  buddyStep($b, st.side < 0 ? 'dance-l' : 'dance-r', Math.min(450, p * 0.85));
  const $arm = $m?.querySelector('i');
  if (!$arm) return;
  $m.classList.remove('tick');
  void $m.offsetWidth;
  $m.classList.add('tick', 'on');
  // it reaches the far side right on the next beat
  $arm.style.transitionDuration = `${Math.round(p)}ms`;
  $arm.style.transform = `rotate(${st.side * -26}deg)`;
}

/** No beat: the metronome comes to rest in the middle and the buddy stands up straight. */
function danceRest($b, $m) {
  if ($b && !$b.classList.contains('hop')) $b.classList.remove('dance-l', 'dance-r');
  const $arm = $m?.querySelector('i');
  if (!$arm || !$m.classList.contains('on')) return;
  $m.classList.remove('on');
  $arm.style.transitionDuration = '600ms';
  $arm.style.transform = 'rotate(0deg)';
}

function onListenFrame(listener, events, now) {
  const wasAsleep = lastListenMood === 'asleep';
  const builtin = listener.mode === 'builtin';
  const beat = listenTest.beat;
  const piano = pianoNow(listener, now);
  // with a beat to follow, the buddy dances on the beat; without one, it hops on each note
  const dancing = piano && !!beat?.following(now);
  for (const ev of events) {
    if (ev.type === 'onset') {
      beat?.note(ev.at);
      // Google decides about half a second late, so with it the buddy hops on each
      // new sound while Google is hearing piano
      if (!builtin && !dancing && listener.hearingPiano(now)) buddyStep(document.querySelector('.listen-buddy'), 'hop');
      continue;
    }
    listenTest.events.push(ev);
    if (ev.type === 'piano') {
      if (builtin && !dancing) buddyStep(document.querySelector('.listen-buddy'), 'hop');
      if (wasAsleep) listenTest.woke = now;
    }
  }
  // beats come due between frames; one step per frame, and only while piano is playing
  if (beat?.beats(now).length && pianoNow(listener, now)) danceBeat(listenTest, document.querySelector('.listen-buddy'), document.getElementById('ls-metro'), beat.period);
  if (!builtin && wasAsleep && listener.hearingPiano(now)) listenTest.woke = now;
  while (listenTest.events.length && now - listenTest.events[0].at > 60000) listenTest.events.shift();
  if (now - listenTest.lastUi > 100) { listenTest.lastUi = now; updateListenUi(listener, now); }
}

function updateListenUi(listener, now) {
  const $ = (id) => document.getElementById(id);
  if (!$('ls-state')) return;
  const st = listener.state;
  const since = listener.since(now);
  const mood = buddyState(since, st.lastPiano != null);
  $('ls-state').textContent = LISTEN_LABELS[mood];
  $('ls-since').textContent = Math.floor(since);
  $('ls-since-bar').style.width = `${Math.min(100, (since / TUNING.asleepAfter) * 100)}%`;
  const pct = (dbv) => Math.max(0, Math.min(100, (dbv + 80) * 1.25));
  $('ls-level').style.width = `${pct(st.level)}%`;
  $('ls-level').classList.toggle('loud', !!st.loud);
  $('ls-gate').style.left = `${pct(st.floor + TUNING.gate)}%`;
  if (st.last) {
    $('ls-last').textContent = st.last.type === 'piano'
      ? `Piano${st.last.note ? ` · ${st.last.note}` : ''}`
      : 'Not piano (talking or noise)';
    const f = st.last.f || {};
    $('ls-last').title = `built-in: ${st.last.local ? 'piano' : 'not piano'} (wobble ${f.wobble?.toFixed(1) ?? '–'} cents, clean ${f.tonal?.toFixed(2)}, growth ${f.growth?.toFixed(1)} dB)${st.last.google != null ? `; Google: ${st.last.google ? 'piano' : 'not piano'}` : ''}`;
  }
  const g = st.google;
  if (g && $('ls-google')) {
    $('ls-google').textContent = g.top.map((c) => `${c.name} ${Math.round(c.score * 100)}%`).join(' · ');
    $('ls-gpiano').style.width = `${Math.min(100, g.piano * 100)}%`;
    $('ls-gpiano').classList.toggle('loud', g.isPiano);
  }
  $('ls-piano').textContent = st.pianoNotes;
  $('ls-other').textContent = st.otherSounds;
  const beat = listenTest.beat;
  const piano = pianoNow(listener, now);
  const dancing = piano && !!beat?.following(now);
  $('ls-beat').textContent = dancing ? `Dancing at about ${beat.bpm} beats a minute` : piano ? LISTEN_BEAT.free : LISTEN_BEAT.none;
  if (!dancing) danceRest(document.querySelector('.listen-buddy'), $('ls-metro'));
  $('ls-line').innerHTML = listenTest.events
    .map((e) => `<span class="dot ${e.type}" style="left:${100 - ((now - e.at) / 60000) * 100}%"></span>`).join('');
  const say = now - listenTest.woke < 2500 ? 'I’m up! Timer back on.' : LISTEN_SAY[mood] || '';
  const $say = $('ls-say');
  if ($say.textContent !== say) $say.textContent = say;
  $say.parentElement.classList.toggle('talking', !!say);
  if (mood !== lastListenMood) {
    lastListenMood = mood;
    const kid = kidById(ui.listenKid) || state.kids[0];
    $('ls-sprite').innerHTML = buddySvg(kid?.buddy || { species: 'fox', outfit: {} }, LISTEN_MOODS[mood], { background: false });
    $('ls-sprite').parentElement.classList.toggle('bobbing', mood === 'playing' || mood === 'waiting');
  }
  if (listenTest.settings && $('ls-mic') && !$('ls-mic').textContent) $('ls-mic').textContent = micNote(listenTest.settings);
}

function viewWardrobe() {
  const kid = kidById(ui.kidId);
  if (!kid) { ui.view = 'home'; return viewHome(); }
  const prog = progressFor(kid);
  const fresh = new Set(kid.newItems || []);
  // buddy specials show only for their own buddy, first in their tab
  const items = ITEMS.filter((i) => i.slot === ui.slot && fitsSpecies(i, kid.buddy.species))
    .sort((a, b) => Boolean(b.species) - Boolean(a.species));
  const nextItem = ITEMS.filter((i) => i.need && !isUnlocked(i, prog)).sort((a, b) => needGap(a, prog) - needGap(b, prog))[0];
  const sportTab = ui.slot === 'sport';
  return `
    <div class="screen wardrobe" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="wardrobe-back" aria-label="Back">←</button>
        <div class="kid-title"><b>${esc(kid.name)}'s buddy</b><small>Best streak ${prog.best} days${prog.pianoPerWeek ? ` · 🎹 Piano streak ${prog.piano} days` : ''}</small></div>
      </header>
      <div class="wardrobe-top">
        <button class="buddy-tap" data-action="buddy-move" data-kid="${kid.id}" aria-label="Tap ${esc(kid.name)}'s buddy">${buddyHtml(kid, 'happy', 'lg', { live: true, feel: { valence: 0.8, arousal: 0.6 } })}</button>
        <div class="buddy-side">
          <div class="pick">${SPECIES.map((sp) => `<button class="pick-item species ${kid.buddy.species === sp.id ? 'on' : ''}" data-action="wardrobe-species" data-val="${sp.id}" aria-label="${sp.name}">${buddySvg({ species: sp.id }, 'happy', { background: false })}</button>`).join('')}</div>
          ${sportTab ? `<p class="gem-line">💎 <b>${prog.gems}</b> gems to spend</p>
          <p class="muted">💪 Exercise streak: <b>${prog.ex.weeks} ${prog.ex.weeks === 1 ? 'week' : 'weeks'}</b> (best ${prog.ex.best}) · ${prog.ex.thisWeek} of ${prog.ex.goal} days this week</p>` : `<p class="coin-line">🪙 <b>${prog.coins}</b> coins to spend</p>
          ${nextItem ? `<p class="muted">Next streak prize: <b>${esc(nextItem.name)}</b> at ${esc(needLabel(nextItem))}</p>` : ''}`}
        </div>
      </div>
      <nav class="tabs">${SLOTS.map((sl) => `<button class="${ui.slot === sl.id ? 'on' : ''}" data-action="wardrobe-slot" data-slot="${sl.id}">${sl.icon} ${sl.name}</button>`).join('')}</nav>
      <div class="items">
        ${items.map((item) => {
    const open = isUnlocked(item, prog);
    const on = kid.buddy.outfit[item.slot] === item.id;
    const preview = { ...kid.buddy, outfit: item.slot === 'background' ? { background: item.id } : { background: 'none', [item.slot]: item.id } };
    const wearing = item.slot === 'sport' ? (on ? 'Holding' : 'Tap to hold') : (on ? 'Wearing' : 'Tap to wear');
    const price = item.gems ? `<span class="price gems ${prog.gems >= item.gems ? 'can' : ''}">💎 ${item.gems}</span>`
      : item.price ? `<span class="price ${prog.coins >= item.price ? 'can' : ''}">🪙 ${item.price}</span>` : '';
    return `<button class="item ${open ? '' : 'locked'} ${item.price || item.gems ? 'shop' : ''} ${item.species ? 'special' : ''} ${on ? 'on' : ''}" data-action="wardrobe-item" data-id="${item.id}">
            ${item.species ? `<span class="special-tag">⭐ ${esc(speciesName(item.species))} only</span>` : ''}
            <span class="item-art">${buddySvg(preview, 'happy', { background: item.slot === 'background' })}</span>
            <span class="item-name">${esc(item.name)}${fresh.has(item.id) ? ' <span class="badge">new</span>' : ''}</span>
            <small>${open ? wearing : price || `🔒 ${esc(needLabel(item))}`}</small>
            ${!open && item.need?.pianoWeeks ? `<small class="piano-need">${Math.min(prog.pianoBest, pianoDaysNeeded(item, prog))} of ${pianoDaysNeeded(item, prog)} piano days</small>` : ''}
          </button>`;
  }).join('')}
      </div>
      ${sportTab ? movesList(kid, prog) : ''}
      ${ui.slot === 'music' ? `<p class="muted small">Do piano every time it's on your list to grow your piano streak (a day off from piano doesn't break it). Your best piano streak is ${prog.pianoBest} days.</p>` : ''}
      ${sportTab ? `<p class="muted small">Only exercise earns 💎 gems, and only gems buy sports gear. Gear works with every buddy. Exercise on ${prog.ex.goal} days in a week to keep your exercise streak going: 1, 3 and 6 weeks in a row unlock new moves for each piece of gear you own, and moves stay yours even if the streak ends. Tap your buddy to see a move. Visiting buddies with a fishing rod go fishing!</p>` : ''}
      ${sportTab ? '' : `<p class="muted small">Every task you finish earns coins. Spend them on anything with a 🪙 price. Hats, glasses and extras you buy belong to the buddy wearing them, so a new buddy needs its own. Places and streak prizes work with every buddy. Streak prizes can't be bought: keep your streak going to win them, and they stay yours even if a streak ends. Tap an item again to take it off.</p>`}
    </div>`;
}

/** Every move, grouped by gear: which ones this kid has, and what the rest need. Tapping one shows it. */
function movesList(kid, prog) {
  const gear = bestGear(prog.owned);
  const have = new Set(unlockedMoves(prog.owned, prog.ex.best).map((m) => m.move.id));
  const kinds = [{ id: 'body', name: 'No gear needed', icon: '🤸' }, ...SPORTS];
  return `<h2>Moves</h2>${kinds.map((k) => `
      <h3 class="moves-kind">${k.icon} ${esc(k.name)}</h3>
      <div class="moves">${MOVES.filter((m) => m.kind === k.id).map((m) => {
    const open = have.has(m.id);
    const weeks = moveWeeks(m);
    const need = k.id !== 'body' && !gear[k.id] ? `Get a ${k.name.toLowerCase()} and a ${weeks}-week streak` : `${weeks}-week exercise streak`;
    return `<button class="move ${open ? '' : 'locked'}" ${open ? `data-action="try-move" data-move="${m.id}"` : 'data-action="move-locked"'} data-need="${esc(need)}">
          <b>${open ? '' : '🔒 '}${esc(m.name)}</b><small>${open ? 'Tap to see it' : esc(need)}</small></button>`;
  }).join('')}</div>`).join('')}`;
}

// ----- parent area -----

function viewParent() {
  const pending = pendingApprovals(state, today());
  const tabs = [
    ['approvals', `Approvals${pending.length ? ` <span class="badge">${pending.length}</span>` : ''}`],
    ['kids', 'Kids & tasks'],
    ['history', 'Past days'],
    ['settings', 'Settings'],
  ];
  let body = '';
  if (ui.tab === 'approvals') body = parentApprovals(pending);
  else if (ui.tab === 'kids') body = ui.editKidId ? parentEditKid() : parentKids();
  else if (ui.tab === 'history') body = parentHistory();
  else body = parentSettings();
  return `
    <div class="screen parent">
      <header class="top row">
        <h1>Parent area</h1>
        <button class="btn" data-action="parent-exit">Done</button>
      </header>
      <nav class="tabs">${tabs.map(([id, label]) => `<button class="${ui.tab === id ? 'on' : ''}" data-action="tab" data-tab="${id}">${label}</button>`).join('')}</nav>
      ${body}
    </div>`;
}

// "· 12 min in other apps" when some of a timer ran while the kid was in another app.
function awayNote(kid, key, task) {
  const away = entryFor(state, kid.id, key)?.tasks?.[task.id]?.away || 0;
  const min = Math.round(away / 60);
  return away ? ` · ${min || '<1'} min in other apps` : '';
}

function parentApprovals(pending) {
  if (!pending.length) return '<div class="empty"><p>Nothing to check right now. 🎉</p></div>';
  return `
    <div class="row end"><button class="btn" data-action="approve-all">Approve all (${pending.length})</button></div>
    <div class="list">
      ${pending.map(({ key, kid, task }) => `
        <div class="list-row">
          ${buddyChip(kid)}
          <div class="grow"><b>${esc(kid.name)}: ${esc(task.icon)} ${esc(task.name)}</b><small class="muted">${esc(friendlyDate(key))}${task.minutes ? ` · ${task.minutes} min timer finished${awayNote(kid, key, task)}` : ''}</small></div>
          <button class="btn ghost" data-action="send-back" data-kid="${kid.id}" data-key="${key}" data-task="${task.id}">Send back</button>
          <button class="btn" data-action="approve" data-kid="${kid.id}" data-key="${key}" data-task="${task.id}">Approve</button>
        </div>`).join('')}
    </div>`;
}

function parentKids() {
  const t = today();
  const log = state.kids.flatMap((kid) => recentBonuses(state, kid, t)).sort((a, b) => (b.at || 0) - (a.at || 0));
  return `
    <div class="list">
      ${state.kids.map((kid) => {
    const w = weekEarnings(state, kid, t);
    const week = w.allowance ? `🪙 ${w.coins} of ${w.allowance.coins} this week${w.bonus ? ` + ${w.bonus} bonus` : ''}` : `${kid.tasks.length} tasks${w.bonus ? ` · ${w.bonus} bonus this week` : ''}`;
    return `
        <div class="list-row">
          ${buddyChip(kid)}
          <div class="grow"><b>${esc(kid.name)}</b><small class="muted">${week}</small></div>
          <button class="btn ghost" data-action="bonus" data-kid="${kid.id}" ${w.bonusLeft ? '' : 'disabled'}>🎁 Bonus</button>
          <button class="btn ghost" data-action="edit-kid" data-id="${kid.id}">Edit</button>
        </div>`;
  }).join('') || '<p class="muted">No kids yet.</p>'}
    </div>
    ${log.length ? `
    <h2>🎁 Bonus log</h2>
    <div class="list bonus-log">
      ${log.map((b) => `
        <div class="list-row">
          ${buddyChip(b.kid)}
          <div class="grow"><b>${esc(b.kid.name)}: +${b.coins} ${esc(b.reason || 'Bonus')}</b><small class="muted">${esc(friendlyDate(b.key))} · from ${esc(b.by || 'a parent')}</small></div>
          <button class="linkish" data-action="bonus-remove" data-kid="${b.kid.id}" data-key="${b.key}" data-id="${b.id}" aria-label="Take back this bonus">✕</button>
        </div>`).join('')}
    </div>` : ''}
    ${cloudCfg?.role === 'kid' ? '' : '<button class="btn" data-action="add-kid">+ Add a kid</button>'}
    <p class="muted small">New kids start with the standard routine: morning teeth, bed and floor; piano Monday to Friday; chore of the week Monday to Thursday; deep clean, vacuum and dust on Friday; laundry on Saturday. Change any of it per kid.</p>`;
}

function dayChips(task) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="daychip ${task.days.includes(d) ? 'on' : ''}" data-action="toggle-day" data-task="${task.id}" data-day="${d}">${DAY_NAMES[d]}</button>`).join('');
}

// "About 6 🪙 and 6 XP each time": this week's share of the allowance, from the setup as it is now.
function payNote(kid, task) {
  const days = [];
  const monday = weekStart(today());
  for (let i = 0; i < 7; i += 1) days.push(addDays(monday, i));
  const on = days.filter((d) => task.days.includes(parseKey(d).getDay()) && onWeek(task, d));
  if (!on.length) return isEveryOtherWeek(task) ? 'Off this week' : 'Not on any day';
  const pays = on.map((d) => taskPay(state, kid, d, task, d));
  const avg = (f) => Math.round(pays.reduce((n, p) => n + p[f], 0) / pays.length);
  return `About ${avg('coins')} 🪙 and ${avg('xp')} XP each time`;
}

const sameTask = (a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
const shortDate = (key) => parseKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Other kids who do this task (same name) on the opposite weeks. */
function turnPartners(kid, task) {
  if (!isEveryOtherWeek(task)) return [];
  return state.kids.filter((k) => k.id !== kid.id && k.tasks.some((t) => sameTask(t, task) && isEveryOtherWeek(t) && t.everyOtherWeek !== task.everyOtherWeek));
}

/** "Every week" or "Every other week" with this week on or off, plus the turn-taking buttons. */
function repeatRow(kid, t) {
  const now = today();
  const parity = weekParity(now);
  const val = !isEveryOtherWeek(t) ? 'every' : t.everyOtherWeek === parity ? 'this' : 'next';
  const nextMon = addDays(weekStart(now), 7);
  const note = val === 'this' ? `On this week, off the week of ${shortDate(nextMon)}` : val === 'next' ? `Off this week, on from ${shortDate(nextMon)}` : '';
  const partners = turnPartners(kid, t);
  const others = t.period === 'exercise' || val === 'every' ? [] : state.kids.filter((k) => k.id !== kid.id && !partners.includes(k));
  return `
      <div class="row wrap repeat-edit">
        <label>Repeats <select data-action-change="task-repeat" data-task="${t.id}">
          <option value="every" ${val === 'every' ? 'selected' : ''}>Every week</option>
          <option value="this" ${val === 'this' ? 'selected' : ''}>Every other week, from this week</option>
          <option value="next" ${val === 'next' ? 'selected' : ''}>Every other week, from next week</option>
        </select></label>
        ${note ? `<small class="muted">${note}</small>` : ''}
      </div>
      ${partners.length ? `<p class="small turns">🔁 Takes turns with ${partners.map((k) => `<b>${esc(k.name)}</b>`).join(' and ')}</p>` : ''}
      ${others.length ? `<div class="row wrap turns"><small class="muted">Take turns with</small>${others.map((k) => `<button class="btn ghost small-btn" data-action="task-turns" data-task="${t.id}" data-kid="${k.id}">${esc(k.name)}</button>`).join('')}</div>` : ''}`;
}

function parentEditKid() {
  const kid = kidById(ui.editKidId);
  if (!kid) { ui.editKidId = null; return parentKids(); }
  const allowance = allowanceFor(state, kid);
  const fam = state.settings.allowance;
  const taskRows = (period) => kid.tasks.filter((t) => t.period === period).map((t) => `
    <div class="task-edit" data-task="${t.id}">
      <div class="row">
        <input class="icon-input" data-field="icon" value="${esc(t.icon)}" aria-label="Icon">
        <input class="grow" data-field="name" value="${esc(t.name)}" aria-label="Task name">
        <button class="btn ghost round" data-action="move-task" data-task="${t.id}" data-dir="-1" aria-label="Move up">↑</button>
        <button class="btn ghost round" data-action="move-task" data-task="${t.id}" data-dir="1" aria-label="Move down">↓</button>
        <button class="btn ghost round danger-text" data-action="delete-task" data-task="${t.id}" aria-label="Delete">✕</button>
      </div>
      <div class="days">${dayChips(t)}</div>${repeatRow(kid, t)}
      <div class="row wrap">
        <label>When <select data-field="period"><option value="morning" ${t.period === 'morning' ? 'selected' : ''}>Morning</option><option value="afternoon" ${t.period === 'afternoon' ? 'selected' : ''}>After school</option><option value="exercise" ${t.period === 'exercise' ? 'selected' : ''}>Bonus exercise</option></select></label>
        <label>Checked by <select data-field="verify"><option value="self" ${t.verify === 'self' ? 'selected' : ''}>Kid taps done</option><option value="parent" ${t.verify === 'parent' ? 'selected' : ''}>Parent PIN</option></select></label>
        <label>Timer <input type="number" min="0" max="180" step="5" data-field="minutes" value="${t.minutes}" class="num"> min</label>
        ${t.minutes > 0 ? `<label class="row"><input type="checkbox" data-field="background" ${t.background ? 'checked' : ''}> Keep counting in other apps</label>
        <label class="row"><input type="checkbox" data-field="listen" ${t.listen ? 'checked' : ''}> Listen to the piano</label>` : ''}
      </div>
      ${t.minutes > 0 && t.listen ? '<small class="muted task-hint">While the timer runs, the buddy listens and dances to the playing. With no piano for 30 seconds it gets bored; after a minute it falls asleep and the timer pauses until the piano starts again. It uses the microphone only on the timer screen, and nothing is recorded. Try it in Settings › Piano listening test.</small>' : ''}
      ${isExercise(t) ? `<div class="row wrap reward-edit">
        <label>Earns 💎 <input type="number" min="0" max="${MAX_REWARD}" step="1" data-field="gems" value="${Number.isFinite(t.gems) ? t.gems : ''}" placeholder="${DEFAULT_GEMS}" class="num" aria-label="Gems earned"> gems</label>
        <label>and <input type="number" min="0" max="${MAX_REWARD}" step="1" data-field="xp" value="${Number.isFinite(t.xp) ? t.xp : ''}" placeholder="${defaultReward(t)}" class="num" aria-label="XP earned"> XP</label>
      </div>` : allowance ? `<div class="row wrap reward-edit">
        <label>Size <select data-field="size">${SIZES.map((sz) => `<option value="${sz.id}" ${taskSize(t) === sz.id ? 'selected' : ''}>${sz.name}</option>`).join('')}</select></label>
        <small class="muted">${payNote(kid, t)}</small>
      </div>` : `<div class="row wrap reward-edit">
        <label>Earns 🪙 <input type="number" min="0" max="${MAX_REWARD}" step="1" data-field="coins" value="${Number.isFinite(t.coins) ? t.coins : ''}" placeholder="${defaultReward(t)}" class="num" aria-label="Coins earned"> coins</label>
        <label>and <input type="number" min="0" max="${MAX_REWARD}" step="1" data-field="xp" value="${Number.isFinite(t.xp) ? t.xp : ''}" placeholder="${defaultReward(t)}" class="num" aria-label="XP earned"> XP</label>
      </div>`}
    </div>`).join('');
  return `
    <div class="row"><button class="btn ghost" data-action="edit-kid-done">← All kids</button></div>
    <div class="card">
      <label class="block">Name <input data-kidfield="name" value="${esc(kid.name)}"></label>
      <div class="block">Buddy <div class="pick">${SPECIES.map((sp) => `<button class="pick-item species ${kid.buddy.species === sp.id ? 'on' : ''}" data-action="kid-species" data-val="${sp.id}" aria-label="${sp.name}">${buddySvg({ species: sp.id }, 'happy', { background: false })}</button>`).join('')}</div></div>
      <div class="block">Color <div class="pick">${COLORS.map((c) => `<button class="pick-item swatch ${kid.color === c ? 'on' : ''}" style="background:${c}" data-action="kid-color" data-val="${c}" aria-label="${c}"></button>`).join('')}</div></div>
      ${allowance ? `<div class="block">Weekly allowance
        <div class="row wrap allow-row">
          <label>🪙 <input type="number" min="0" step="10" class="num" data-kidallow="coins" value="${Number.isFinite(kid.allowance?.coins) ? kid.allowance.coins : ''}" placeholder="${fam.coins}" aria-label="Coins a week"> coins</label>
          <label><input type="number" min="0" step="10" class="num" data-kidallow="xp" value="${Number.isFinite(kid.allowance?.xp) ? kid.allowance.xp : ''}" placeholder="${fam.xp}" aria-label="XP a week"> XP a week</label>
        </div>
        <small class="muted allow-help">Leave empty to use the family's amount (Settings). A perfect week earns exactly this, split across ${esc(kid.name)}'s tasks by size.</small>
      </div>` : ''}
    </div>
    <h2>🌅 Morning tasks</h2>
    ${taskRows('morning')}
    <button class="btn ghost" data-action="add-task" data-period="morning">+ Add morning task</button>
    <h2>☀️ After-school tasks</h2>
    ${taskRows('afternoon')}
    <button class="btn ghost" data-action="add-task" data-period="afternoon">+ Add after-school task</button>
    <h2>💪 Bonus exercise</h2>
    ${taskRows('exercise') || '<p class="muted small">None yet. Add a run, a bike ride, soccer practice or anything active.</p>'}
    <button class="btn ghost" data-action="add-task" data-period="exercise">+ Add exercise task</button>
    <p class="muted small">Exercise tasks are optional: they never count toward the streak or the day's treasure. Each one earns ${DEFAULT_GEMS} 💎 gems unless you type another amount. Gems only buy sports gear. Exercising on ${EXERCISE_DAYS} days in a week keeps the exercise streak going, which unlocks moves for the kid's buddy at 1, 3 and 6 weeks. A day you excuse in Past days (sick, travel) counts neither for nor against it: that week just needs one fewer exercise day, and a week with 5 or more excused days is skipped. You can excuse days afterwards too, and streaks update right away.</p>
    <p class="muted small">A task can repeat every other week (weeks run Monday to Sunday). To have two kids take turns, like cleaning the bathroom, set the task to every other week for one kid, then tap the other kid's name next to “Take turns with”: they get the same task on the opposite weeks. On a kid's off week the task isn't on their list at all, so it never counts against their streak or the day's treasure.</p>
    <p class="muted small">Changes apply from today. Past days keep the tasks they had. A timer task (like piano) counts minutes only while the app is open, unless you tick “Keep counting in other apps” (for an app like Note Rush). Time spent in other apps shows when you approve it. ${allowance ? `${esc(kid.name)} earns up to ${allowance.coins} coins and ${allowance.xp} XP a week. It is split across the week's tasks by size: a big task is worth 3 small ones, a medium one 2. A kid with more tasks doesn't earn more, each task is just worth a little less, and a missed task loses its share. Exercise is extra: it earns gems and its own XP.` : 'Each task earns 10 coins and 10 XP (30 for a timer task) unless you type other amounts; leave a box empty to use the default.'} Changes count from today, so coins already earned stay earned. Every 100 XP is a level.</p>
    <hr>
    <button class="btn danger" data-action="delete-kid">Remove ${esc(kid.name)}</button>`;
}

function parentHistory() {
  const t = today();
  const key = ui.historyDate || addDays(t, -1);
  return `
    <div class="row">
      <label>Day <input type="date" data-action-change="history-date" value="${key}" max="${t}"></label>
    </div>
    ${state.kids.map((kid) => {
    if (kid.startDate && key < kid.startDate) return `<div class="card"><b>${esc(kid.name)}</b><p class="muted">Started using the app ${esc(friendlyDate(kid.startDate))}.</p></div>`;
    const s = dayStatus(state, kid, key, t);
    const entry = entryFor(state, kid.id, key);
    return `
      <div class="card">
        <div class="row">${buddyChip(kid)}<b class="grow">${esc(kid.name)}</b><span class="muted">${s.done}/${s.total} done${s.complete ? ' ✓' : ''}</span></div>
        ${tasksForDay(state, kid, key, t).map((task) => {
    const st = entry?.tasks?.[task.id]?.status;
    return `<div class="list-row">
            <span>${esc(task.icon)}</span><span class="grow">${esc(task.name)}${isExercise(task) ? ' <small class="muted">bonus</small>' : ''}</span>
            <button class="btn ${st === 'done' ? '' : 'ghost'}" data-action="history-toggle" data-kid="${kid.id}" data-key="${key}" data-task="${task.id}">${st === 'done' ? '✓ Done' : st === 'pending' ? 'Approve' : 'Mark done'}</button>
          </div>`;
  }).join('')}
        <label class="row"><input type="checkbox" data-action-change="history-excuse" data-kid="${kid.id}" data-key="${key}" ${s.excused ? 'checked' : ''}> Excused day (sick, travel, recital). The streak is kept.</label>
      </div>`;
  }).join('')}
    <p class="muted small">Streaks update right away, so approving yesterday's tasks late keeps the streak.</p>`;
}

function parentSettings() {
  const st = state.settings;
  const notif = 'Notification' in window ? Notification.permission : 'unsupported';
  return `
    <div class="card">
      <label class="block">Weekly reward (shown when a kid finishes 7 days in a row)
        <input data-setting="weeklyReward" value="${esc(st.weeklyReward)}"></label>
      <div class="row wrap">
        <label>Morning tasks by <input type="time" data-setting="morningBy" value="${esc(st.morningBy)}"></label>
        <label>Everything by <input type="time" data-setting="bedtime" value="${esc(st.bedtime)}"></label>
      </div>
      <div class="block">Reminder times
        <div class="row wrap">
          ${st.reminders.map((r, i) => `<span class="chip"><input type="time" data-reminder="${i}" value="${esc(r)}"><button class="linkish" data-action="remove-reminder" data-i="${i}" aria-label="Remove">✕</button></span>`).join('')}
          <button class="btn ghost" data-action="add-reminder">+ Add</button>
        </div>
        <small class="muted">Reminders play a sound and show a banner when the app is open at that time${notif === 'granted' ? ', and a notification if it is in the background' : ''}. A web app cannot wake a closed app, so for a reliable nudge also set an Android clock alarm.</small>
        ${notif === 'default' ? '<div><button class="btn ghost" data-action="allow-notify">Allow notifications</button></div>' : ''}
      </div>
      <label class="row"><input type="checkbox" data-setting-bool="sound" ${st.sound ? 'checked' : ''}> Sounds on</label>
    </div>
${allowanceCard()}
    <div class="card">
      <h2>🎹 Piano listening test</h2>
      <p class="muted small">Try how well the tablet hears piano playing. To have a kid’s practice timer listen, turn on “Listen to the piano” for that task in Kids &amp; tasks. Nothing is recorded or saved.</p>
      <button class="btn ghost" data-action="listen-open">Open the listening test</button>
    </div>
    <div class="card">
      <h2>Parent PIN</h2>
      <button class="btn ghost" data-action="change-pin">Change PIN</button>
    </div>
    <div class="card">
      <h2>Backup</h2>
      ${cloudCfg ? `
      <p class="muted small">Progress is kept in your family's cloud. A backup file is still a handy extra copy.</p>
      <div class="row wrap"><button class="btn" data-action="export">Save backup file</button></div>` : `
      <p class="muted small">Everything is saved only on this tablet. Save a backup file now and then (for example to Google Drive) so a reset or new tablet doesn't lose streaks.</p>
      <div class="row wrap">
        <button class="btn" data-action="export">Save backup file</button>
        <label class="btn ghost">Restore from file<input type="file" accept="application/json,.json" data-action-change="import" hidden></label>
      </div>`}
    </div>
    ${familyCard()}`;
}

function allowanceCard() {
  const a = state.settings.allowance || defaultAllowance(today());
  return `
    <div class="card">
      <h2>🪙 Weekly allowance</h2>
      <label class="row"><input type="checkbox" data-allowance-on ${a.on ? 'checked' : ''}> Limit what each kid can earn in a week</label>
      ${a.on ? `
      <div class="row wrap allow-row">
        <label>🪙 <input type="number" min="0" step="10" class="num" data-allow="coins" value="${a.coins}" aria-label="Coins a week"> coins</label>
        <label><input type="number" min="0" step="10" class="num" data-allow="xp" value="${a.xp}" aria-label="XP a week"> XP a week</label>
      </div>
      <div class="row wrap allow-row"><label>Bonus up to 🪙 <input type="number" min="0" step="5" class="num" data-allow="bonus" value="${a.bonus}" aria-label="Bonus limit"> a week per kid</label></div>
      <small class="muted allow-help">Every kid can earn the same amount for a perfect week, however many tasks they have. It is split across each kid's tasks by size (set in Kids &amp; tasks). You can give one kid a different amount in their page. On top of it, either parent can give a 🎁 bonus with a reason, up to the bonus limit; bonuses also add the same XP. Changes count from today.</small>` : '<small class="muted">Off: each task earns the coins and XP typed on it in Kids &amp; tasks.</small>'}
    </div>`;
}

/** The name a bonus is signed with: the signed-in parent's first name on a parent's phone. */
function parentName() {
  const user = cloudCfg?.role === 'parent' ? cloud.mod?.currentUser?.() : null;
  const name = user?.displayName || '';
  return name.split(' ')[0] || (cloudCfg?.role === 'parent' && cloudCfg.email ? cloudCfg.email.split('@')[0] : 'a parent');
}

const BONUS_REASONS = ['Helped without being asked', 'Kind to a sibling', 'Extra chore', 'Great attitude', 'Worked really hard'];

function bonusModal(kid, amount = null, reason = '') {
  const w = weekEarnings(state, kid, today());
  const left = w.bonusLeft;
  const amounts = [...new Set([5, 10, 20, left].filter((n) => n > 0 && n <= left))].sort((x, y) => x - y);
  const pick = amount && amount <= left ? amount : amounts[0];
  openModal(`
    <h2>🎁 Bonus for ${esc(kid.name)}</h2>
    <p class="muted small">${left} of ${w.bonusLimit} bonus coins left this week. A bonus adds the same XP too.</p>
    <div class="block">How much
      <div class="row wrap">${amounts.map((n) => `<button class="btn ${n === pick ? '' : 'ghost'}" data-action="bonus-amount" data-n="${n}">+${n} 🪙</button>`).join('')}</div>
    </div>
    <div class="block">What for
      <div class="row wrap">${BONUS_REASONS.map((r) => `<button class="btn ${r === reason ? '' : 'ghost'} small-btn" data-action="bonus-reason" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <input class="bonus-why" maxlength="60" placeholder="Or type a reason" value="${esc(BONUS_REASONS.includes(reason) ? '' : reason)}">
    </div>
    <div class="row end">
      <button class="btn ghost" data-action="modal-close">Cancel</button>
      <button class="btn" data-action="bonus-give" data-kid="${kid.id}" data-n="${pick}">Give +${pick} 🪙</button>
    </div>`);
  $modal.dataset.reason = reason;
}

/** Switch buddies. Each buddy remembers what it was wearing; bought hats and such stay with the buddy they were bought for. */
function changeSpecies(kid, species) {
  const prog = progressFor(kid);
  switchSpecies(kid, species, (item, sp) => fitsSpecies(item, sp) && isUnlocked(item, { ...prog, owned: ownedFor(kid, sp) }));
}

// The buddy can't sit at a piano and play sports at once: picking one puts the other away.
const ONE_OR_THE_OTHER = { music: 'sport', sport: 'music' };
function putAwayOther(kid, slot) {
  const other = ONE_OR_THE_OTHER[slot];
  const outfit = kid.buddy.outfit;
  if (!other || !outfit[other]) return;
  const name = itemById(outfit[other])?.name;
  delete outfit[other];
  if (name) setTimeout(() => toast(`${name} put away for now`), 50);
}

const speciesName = (id) => SPECIES.find((sp) => sp.id === id)?.name || 'buddy';

function buyGear(kid, item, prog) {
  if (prog.gems < item.gems) {
    sounds.error();
    toast(`${item.gems - prog.gems} more gems to go! Exercise to earn them. 💪`);
    return;
  }
  const preview = { ...kid.buddy, outfit: { ...kid.buddy.outfit, sport: item.id } };
  openModal(`
    <div class="celebrate">
      <div class="buddy buddy-xl mood-happy">${buddySvg(preview, 'happy')}</div>
      <h1>Buy ${esc(item.name)}?</h1>
      <p>It costs <b>💎 ${item.gems}</b>. You'll have ${prog.gems - item.gems} gems left.</p>
      <p class="muted small">Every buddy can use it. Keep exercising to unlock its moves.</p>
      <div class="stack">
        <button class="btn huge" data-action="buy-confirm" data-id="${item.id}">Buy it!</button>
        <button class="btn ghost" data-action="modal-close">Keep saving</button>
      </div>
    </div>`);
}

function buyItem(kid, item, prog) {
  if (item.gems) { buyGear(kid, item, prog); return; }
  if (prog.coins < item.price) {
    sounds.error();
    toast(`${item.price - prog.coins} more coins to go! Finish tasks to earn them.`);
    return;
  }
  const preview = { ...kid.buddy, outfit: { ...kid.buddy.outfit, [item.slot]: item.id } };
  openModal(`
    <div class="celebrate">
      <div class="buddy buddy-xl mood-happy">${buddySvg(preview, 'happy')}</div>
      <h1>Buy ${esc(item.name)}${isWorn(item) ? ` for your ${esc(speciesName(kid.buddy.species).toLowerCase())}` : ''}?</h1>
      <p>It costs <b>🪙 ${item.price}</b>. You'll have ${prog.coins - item.price} coins left.</p>
      ${item.species ? `<p class="muted small">⭐ A special made just for ${esc(speciesName(item.species).toLowerCase())}s. Every kind of buddy has its own.</p>`
    : isWorn(item) ? '<p class="muted small">Only this buddy can wear it. Other buddies need their own.</p>' : ''}
      <div class="stack">
        <button class="btn huge" data-action="buy-confirm" data-id="${item.id}">Buy it!</button>
        <button class="btn ghost" data-action="modal-close">Keep saving</button>
      </div>
    </div>`);
}

const views = { setup: viewSetup, home: viewHome, kid: viewKid, timer: viewTimer, parent: viewParent, wardrobe: viewWardrobe, listen: viewListen };

// Rows that scroll sideways (wardrobe tabs, buddy picker...) keep their place when the screen is redrawn.
const SIDE_SCROLLERS = '.tabs, .pick';
let lastHtml = '';
let lastView = '';

// The weekly allowance starts the day after this version first runs (on a
// synced device, once the family's data has arrived, so it uses the family's
// date). Starting tomorrow keeps chores already ticked today at their typed
// amounts. repairAllowanceStart fixes families stamped by the older rule,
// which started it the same day and lowered that day's coins.
function stampAllowance() {
  if (cloudCfg && !cloud.gotState) return;
  if (!state.settings.allowance) {
    state.settings.allowance = { ...defaultAllowance(addDays(today(), 1)), startFixed: true };
    save();
  } else if (repairAllowanceStart(state)) {
    save();
  }
}

function render() {
  stampAllowance();
  const scrollY = window.scrollY;
  const keepScroll = ui.view === 'parent' || ui.view === 'wardrobe';
  const html = (views[ui.view] || viewHome)();
  // load the sign-in code early, so a sign-in popup opens straight from the tap
  if (ui.view === 'setup' || (ui.view === 'parent' && ui.tab === 'settings')) loadCloud().catch(() => {});
  // Family sync can ask for a redraw many times a minute (another tablet saving, a piano timer
  // ticking). When nothing on screen changed, leave the page alone: the visitors don't arrive
  // again, the fish keep swimming and a half-scrolled row stays where it is.
  if (html === lastHtml && $app.firstElementChild) { syncMusic(); return; }
  const sameView = lastView === ui.view;
  const side = sameView ? [...$app.querySelectorAll(SIDE_SCROLLERS)].map((el) => el.scrollLeft) : [];
  $app.innerHTML = html;
  lastHtml = html;
  lastView = ui.view;
  $app.querySelectorAll(SIDE_SCROLLERS).forEach((el, i) => { if (side[i]) el.scrollLeft = side[i]; });
  paintQuestMaps($app);
  liveStart();
  syncMusic();
  if (keepScroll) window.scrollTo(0, scrollY);
}

/** Map music plays only on the quest map, with sound on and music not muted, while the app is visible. */
function syncMusic() {
  const onMap = ui.view === 'kid' && state.settings.questView !== 'list';
  const wanted = onMap && state.settings.sound && state.settings.music !== false && document.visibilityState === 'visible';
  if (wanted) startMusic(kidTheme(kidById(ui.kidId) || {}));
  else stopMusic();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => paintQuestMaps($app), 150);
});

// ---------- events ----------

const actions = {
  'setup-pin': () => pinPad({ title: 'Choose a parent PIN', subtitle: 'Pick 4 digits the kids don’t know', mode: 'new', onSuccess: () => { ui.view = 'parent'; ui.tab = 'kids'; render(); toast('PIN saved. Now add your kids.'); } }),
  home: () => { ui.view = 'home'; render(); },
  'open-kid': (el) => {
    ui.kidId = el.dataset.id; ui.view = 'kid'; render();
    setTimeout(() => celebrateIfDue(kidById(ui.kidId)), 300);
  },
  task: (el) => onTaskTap(el.dataset.id, el),
  'timer-start': () => { wakeEars(); startTimer(); startEars(); },
  'timer-pause': () => { stopEars(); stopTimer(); },
  'timer-buddy': () => buddyCheer(),
  'timer-back': () => { stopEars(); stopTimer(false); ui.view = 'kid'; render(); },
  parent: () => pinPad({ title: 'Parents only', subtitle: 'Type the parent PIN', onSuccess: () => { ui.view = 'parent'; ui.tab = pendingApprovals(state, today()).length ? 'approvals' : ui.tab; render(); } }),
  'listen-open': () => { ui.view = 'listen'; ui.listenKid = ui.listenKid || state.kids[0]?.id; render(); window.scrollTo(0, 0); },
  'listen-back': () => { stopListenTest(); ui.view = 'parent'; ui.tab = 'settings'; render(); },
  'listen-start': () => startListenTest(),
  'listen-mode': (el) => {
    const was = !!listenTest.run;
    stopListenTest();
    ui.listenMode = el.dataset.mode;
    try { localStorage.setItem(LISTEN_MODE_KEY, ui.listenMode); } catch { /* the choice lasts while the page is open */ }
    render();
    if (was) startListenTest();
  },
  'listen-stop': () => { stopListenTest(); render(); },
  'listen-kid': (el) => { ui.listenKid = el.dataset.id; lastListenMood = ''; render(); },
  'parent-exit': () => { ui.view = 'home'; ui.editKidId = null; render(); },
  tab: (el) => { ui.tab = el.dataset.tab; ui.editKidId = null; render(); },
  approve: (el) => approve(el.dataset.kid, el.dataset.key, el.dataset.task),
  'approve-all': () => {
    for (const { kid, key, task } of pendingApprovals(state, today())) setTask(kid, key, task, { status: 'done', by: 'parent', at: Date.now() });
    sounds.task(); render();
  },
  'send-back': (el) => {
    const kid = kidById(el.dataset.kid);
    const task = taskById(kid, el.dataset.key, el.dataset.task);
    setTask(kid, el.dataset.key, task, null);
    toast(`Sent back to ${kid.name}`); render();
  },
  'add-kid': () => {
    const n = state.kids.length;
    const kid = { id: newId('kid'), name: `Kid ${n + 1}`, buddy: defaultBuddy(SPECIES[n % SPECIES.length].id), seenUnlocks: [], color: COLORS[(n * 2) % COLORS.length], tasks: defaultTasks(), startDate: today() };
    state.kids.push(kid); save();
    ui.editKidId = kid.id; render();
  },
  'edit-kid': (el) => { ui.editKidId = el.dataset.id; render(); window.scrollTo(0, 0); },
  'edit-kid-done': () => { ui.editKidId = null; render(); },
  'kid-species': (el) => { changeSpecies(kidById(ui.editKidId), el.dataset.val); save(); render(); },
  wardrobe: () => { ui.view = 'wardrobe'; render(); window.scrollTo(0, 0); },
  'wardrobe-back': () => { ui.view = 'kid'; render(); },
  'wardrobe-slot': (el) => { ui.slot = el.dataset.slot; render(); },
  'wardrobe-species': (el) => { changeSpecies(kidById(ui.kidId), el.dataset.val); sounds.tap(); save(); render(); },
  'wardrobe-item': (el) => {
    const kid = kidById(ui.kidId);
    const item = itemById(el.dataset.id);
    if (!item || !fitsSpecies(item, kid.buddy.species)) return;
    const prog = progressFor(kid);
    if (!isUnlocked(item, prog) && (item.price || item.gems)) { buyItem(kid, item, prog); return; }
    if (!isUnlocked(item, prog)) { sounds.error(); toast(`Win it with a ${needLabel(item)}`); return; }
    const outfit = kid.buddy.outfit;
    if (outfit[item.slot] === item.id && item.slot !== 'background') delete outfit[item.slot];
    else { outfit[item.slot] = item.id; putAwayOther(kid, item.slot); }
    kid.newItems = (kid.newItems || []).filter((id) => id !== item.id);
    sounds.task(); save(); render();
  },
  'music-toggle': () => { state.settings.music = state.settings.music === false; save(); render(); },
  'quest-mode': (el) => { state.settings.questView = el.dataset.mode; save(); render(); },
  chest: () => {
    const kid = kidById(ui.kidId);
    const t = today();
    const s = dayStatus(state, kid, t, t);
    if (s.complete) { sounds.day(); confetti(100, 2000); toast('You found the treasure! 🏆'); } else { sounds.tap(); toast(`${s.total - s.done} more to reach the treasure!`); }
  },
  'buy-confirm': (el) => {
    const kid = kidById(ui.kidId);
    const item = itemById(el.dataset.id);
    const prog = progressFor(kid);
    if (!item || prog.owned.includes(item.id) || !fitsSpecies(item, kid.buddy.species)) { closeModal(); return; }
    if (item.gems) {
      if (prog.gems < item.gems) { closeModal(); return; }
      kid.gemsSpent = (kid.gemsSpent || 0) + item.gems;
    } else {
      if (!item.price || prog.coins < item.price) { closeModal(); return; }
      kid.spent = (kid.spent || 0) + item.price;
    }
    addOwned(kid, item);
    kid.buddy.outfit[item.slot] = item.id;
    putAwayOther(kid, item.slot);
    save();
    closeModal();
    sounds.day();
    confetti(80, 1600);
    toast(`${item.name} is yours!`);
    render();
    if (item.gems) setTimeout(() => showUnlocks(kid), 700);
  },
  'try-move': (el) => {
    const kid = kidById(ui.kidId);
    const tap = document.querySelector('.wardrobe-top .buddy-tap');
    if (kid && tap) { tap.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); doMove(tap, mover(kid), el.dataset.move); }
  },
  'move-locked': (el) => { sounds.error(); toast(`🔒 ${el.dataset.need}`); },
  'unlock-try': (el) => { closeModal(); ui.slot = el.dataset.slot; ui.view = 'wardrobe'; render(); window.scrollTo(0, 0); },
  'kid-color': (el) => { kidById(ui.editKidId).color = el.dataset.val; save(); render(); },
  'toggle-day': (el) => {
    const task = kidById(ui.editKidId).tasks.find((t) => t.id === el.dataset.task);
    const d = Number(el.dataset.day);
    task.days = task.days.includes(d) ? task.days.filter((x) => x !== d) : [...task.days, d].sort();
    save(); render();
  },
  'task-turns': (el) => {
    const kid = kidById(ui.editKidId);
    const other = kidById(el.dataset.kid);
    const task = kid?.tasks.find((t) => t.id === el.dataset.task);
    if (!task || !other) return;
    if (!isEveryOtherWeek(task)) task.everyOtherWeek = weekParity(today());
    const off = 1 - task.everyOtherWeek;
    const mine = other.tasks.find((t) => sameTask(t, task));
    if (mine) mine.everyOtherWeek = off;
    else {
      const copy = { ...task, id: newId('task'), days: [...task.days], everyOtherWeek: off };
      other.tasks.push(copy);
    }
    save(); render();
    const first = task.everyOtherWeek === weekParity(today()) ? kid : other;
    toast(`🔁 ${first.name} does ${task.name} this week, ${(first === kid ? other : kid).name} next week`);
  },
  'move-task': (el) => {
    const kid = kidById(ui.editKidId);
    const i = kid.tasks.findIndex((t) => t.id === el.dataset.task);
    const period = kid.tasks[i].period;
    let j = i + Number(el.dataset.dir);
    while (j >= 0 && j < kid.tasks.length && kid.tasks[j].period !== period) j += Number(el.dataset.dir);
    if (j < 0 || j >= kid.tasks.length) return;
    [kid.tasks[i], kid.tasks[j]] = [kid.tasks[j], kid.tasks[i]];
    save(); render();
  },
  'delete-task': (el) => {
    const kid = kidById(ui.editKidId);
    const task = kid.tasks.find((t) => t.id === el.dataset.task);
    confirmModal({ title: 'Delete task?', text: `Remove "${task.name}" for ${kid.name}?`, yes: 'Delete', danger: true, onYes: () => { kid.tasks = kid.tasks.filter((t) => t.id !== task.id); save(); render(); } });
  },
  'add-task': (el) => {
    const ex = el.dataset.period === 'exercise';
    kidById(ui.editKidId).tasks.push({ id: newId('task'), name: ex ? 'Exercise' : 'New task', icon: ex ? '🏃' : '⭐', period: el.dataset.period, days: [0, 1, 2, 3, 4, 5, 6], verify: ex ? 'parent' : 'self', minutes: 0 });
    save(); render();
  },
  'delete-kid': () => {
    const kid = kidById(ui.editKidId);
    confirmModal({ title: `Remove ${kid.name}?`, text: 'Their tasks, streak and history will be deleted from this tablet.', yes: 'Remove', danger: true, onYes: () => { state.kids = state.kids.filter((k) => k.id !== kid.id); ui.editKidId = null; save(); render(); } });
  },
  'history-toggle': (el) => {
    const kid = kidById(el.dataset.kid);
    const key = el.dataset.key;
    const task = tasksForDay(state, kid, key, today()).find((t) => t.id === el.dataset.task);
    const st = entryFor(state, kid.id, key)?.tasks?.[task.id]?.status;
    setTask(kid, key, task, st === 'done' ? null : { status: 'done', by: 'parent', at: Date.now() });
    render();
  },
  'add-reminder': () => { state.settings.reminders.push('17:00'); save(); render(); },
  'remove-reminder': (el) => { state.settings.reminders.splice(Number(el.dataset.i), 1); save(); render(); },
  'allow-notify': async () => { try { await Notification.requestPermission(); } catch { /* ignore */ } render(); },
  'change-pin': () => pinPad({ title: 'Check current PIN', onSuccess: () => pinPad({ title: 'New parent PIN', subtitle: 'Pick 4 digits', mode: 'new', onSuccess: () => toast('PIN changed') }) }),
  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kid-quest-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  bonus: (el) => { const kid = kidById(el.dataset.kid); if (kid) bonusModal(kid); },
  'bonus-amount': (el) => { const kid = kidById($modal.querySelector('[data-action="bonus-give"]').dataset.kid); bonusModal(kid, Number(el.dataset.n), bonusReason()); },
  'bonus-reason': (el) => { const kid = kidById($modal.querySelector('[data-action="bonus-give"]').dataset.kid); bonusModal(kid, Number($modal.querySelector('[data-action="bonus-give"]').dataset.n), el.dataset.r); },
  'bonus-give': (el) => {
    const kid = kidById(el.dataset.kid);
    const left = weekEarnings(state, kid, today()).bonusLeft;
    const coins = Math.min(Number(el.dataset.n) || 0, left);
    if (!coins) { closeModal(); return; }
    const reason = bonusReason() || 'Bonus';
    const entry = entryFor(state, kid.id, today(), true);
    entry.bonus = { ...(entry.bonus || {}), [newId('bonus')]: { coins, reason, by: parentName(), at: Date.now() } };
    save();
    closeModal();
    sounds.task();
    toast(`${kid.name} got +${coins} 🪙`);
    render();
  },
  'bonus-remove': (el) => {
    const kid = kidById(el.dataset.kid);
    const entry = entryFor(state, el.dataset.kid, el.dataset.key);
    const b = entry?.bonus?.[el.dataset.id];
    if (!kid || !b) return;
    confirmModal({ title: 'Take back this bonus?', text: `${kid.name}: +${b.coins} for “${b.reason}”`, yes: 'Take back', danger: true, onYes: () => { delete entry.bonus[el.dataset.id]; save(); render(); } });
  },
  'modal-close': () => closeModal(),
  'modal-yes': () => { const cb = modalYes; modalYes = null; closeModal(); cb?.(); },
};

// The reason typed in the box wins over a picked chip.
function bonusReason() {
  const typed = $modal.querySelector('.bonus-why')?.value.trim();
  return typed || $modal.dataset.reason || '';
}

function approve(kidId, key, taskId) {
  const kid = kidById(kidId);
  const task = taskById(kid, key, taskId);
  setTask(kid, key, task, { status: 'done', by: 'parent', at: Date.now() });
  sounds.task(); render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const name = el.dataset.action;
  if (modalActions[name]) { const fn = modalActions[name]; delete modalActions[name]; fn(el); return; }
  actions[name]?.(el, e);
});

document.addEventListener('change', (e) => {
  const el = e.target;
  // task editor fields
  if (el.dataset.field) {
    const kid = kidById(ui.editKidId);
    const task = kid?.tasks.find((t) => t.id === el.closest('[data-task]')?.dataset.task);
    if (!task) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.field === 'minutes') v = Math.max(0, Math.min(180, Math.round(Number(v) || 0)));
    if (el.dataset.field === 'name' && !v.trim()) v = 'Task';
    const isReward = el.dataset.field === 'coins' || el.dataset.field === 'xp' || el.dataset.field === 'gems';
    if (isReward) v = parseReward(v);
    if (el.dataset.field === 'size') v = Number(v);
    if (v === null) delete task[el.dataset.field];
    else task[el.dataset.field] = v;
    save();
    if (el.tagName === 'SELECT' || el.dataset.field === 'minutes' || el.dataset.field === 'listen' || isReward) render();
    return;
  }
  if (el.dataset.kidallow) {
    const kid = kidById(ui.editKidId);
    const v = parseAllowance(el.value);
    const own = { ...(kid.allowance || {}) };
    if (v === null) delete own[el.dataset.kidallow]; else own[el.dataset.kidallow] = v;
    if (Object.keys(own).length) kid.allowance = own; else delete kid.allowance;
    save(); render(); return;
  }
  if (el.dataset.allow) {
    const v = parseAllowance(el.value);
    const a = state.settings.allowance;
    a[el.dataset.allow] = v ?? (el.dataset.allow === 'bonus' ? DEFAULT_BONUS_LIMIT : DEFAULT_ALLOWANCE);
    save(); render(); return;
  }
  if ('allowanceOn' in el.dataset) {
    const a = state.settings.allowance || defaultAllowance(today());
    // switching back on counts from today, so days earned while it was off stay as they were
    state.settings.allowance = el.checked ? { ...a, on: true, since: a.on ? a.since : today() } : { ...a, on: false };
    save(); render(); return;
  }
  if (el.dataset.kidfield) { kidById(ui.editKidId)[el.dataset.kidfield] = el.value.trim() || 'Kid'; save(); render(); return; }
  if (el.dataset.setting) { state.settings[el.dataset.setting] = el.value; save(); return; }
  if (el.dataset.settingBool) { state.settings[el.dataset.settingBool] = el.checked; setSound(el.checked); save(); return; }
  if (el.dataset.reminder) { state.settings.reminders[Number(el.dataset.reminder)] = el.value; save(); return; }
  const act = el.dataset.actionChange;
  if (act === 'task-repeat') {
    const task = kidById(ui.editKidId)?.tasks.find((t) => t.id === el.dataset.task);
    if (!task) return;
    const parity = weekParity(today());
    if (el.value === 'every') delete task.everyOtherWeek;
    else task.everyOtherWeek = el.value === 'this' ? parity : 1 - parity;
    save(); render();
    return;
  }
  if (act === 'history-date') { ui.historyDate = el.value && el.value <= today() ? el.value : null; render(); }
  if (act === 'history-excuse') { entryFor(state, el.dataset.kid, el.dataset.key, true).excused = el.checked; save(); render(); }
  if (act === 'import') importFile(el.files?.[0]);
});

function importFile(file) {
  if (!file) return;
  file.text().then((text) => {
    let data;
    try { data = JSON.parse(text); } catch { toast('That file is not a Kid Quest backup.'); return; }
    if (!data || !Array.isArray(data.kids) || !data.settings) { toast('That file is not a Kid Quest backup.'); return; }
    confirmModal({
      title: 'Restore backup?',
      text: `This replaces everything on this tablet with the backup (${data.kids.length} kids). The parent PIN becomes the one from the backup.`,
      yes: 'Restore', danger: true,
      onYes: () => { state = migrate(data); setSound(state.settings.sound); save(); ui.view = 'home'; render(); toast('Backup restored'); },
    });
  });
}

// ---------- family sync ----------

let pendingRemote = null;

// One shared load: the settings screen, a join and startup may all ask at once.
let cloudLoading = null;
function loadCloud() {
  cloudLoading ||= import('./cloud.js')
    .then(async (mod) => { await mod.connect(); cloud.mod = mod; return mod; })
    .catch((err) => { cloudLoading = null; throw err; });
  return cloudLoading;
}

function onCloudStatus({ pending, error }) {
  const before = `${cloud.pending}|${cloud.error}`;
  if (pending !== undefined) cloud.pending = pending;
  if (error !== undefined) cloud.error = error;
  if (`${cloud.pending}|${cloud.error}` !== before && ui.view === 'parent' && ui.tab === 'settings') render();
}

async function startCloud() {
  let mod;
  try {
    mod = await loadCloud();
  } catch (err) {
    console.error(err);
    onCloudStatus({ error: 'Could not load sync. It will try again next time the app opens.' });
    return;
  }
  if (!mod.currentUser()) {
    cloud.signedOut = true;
    render();
    return;
  }
  if (cloud.queued) {
    const { before, after } = cloud.queued;
    cloud.queued = null;
    mod.writeChanges(cloudCfg.familyId, mod.changesBetween(before, after), before, after, onCloudStatus);
  }
  cloud.ready = true;
  mod.startSync(cloudCfg, { onState: applyRemote, onStatus: onCloudStatus });
  if (cloudCfg.role === 'kid') {
    mod.watchBuddies(cloudCfg.familyId, (list) => {
      if (stableJson(list) === stableJson(family.buddies)) return;
      family.buddies = list;
      try { localStorage.setItem(BUDDIES_KEY, JSON.stringify(list)); } catch { /* only a cache */ }
      if (ui.view === 'kid' && $modal.hidden) render();
    });
  }
}

// A newer state from the family (another device, or this one's writes coming back).
function applyRemote(next) {
  cloud.gotState = true;
  for (const k of DEVICE_SETTINGS) {
    if (k in state.settings) next.settings[k] = state.settings[k];
    else delete next.settings[k];
  }
  if (stableJson(next) === stableJson(state)) return;
  // don't swap the data under an open dialog; apply it when the dialog closes
  if (!$modal.hidden) { pendingRemote = next; return; }
  state = next;
  store.replace(state);
  if (ui.view === 'setup' && state.settings.pinHash) ui.view = 'home';
  if (ui.view !== 'timer') render();
}

function familyCard() {
  if (!cloudCfg) {
    return `
    <div class="card">
      <h2>Family sync</h2>
      <p class="muted small">Keep progress safe in the cloud and share it between each kid's tablet and the parents' phones. Start the family on a parent's phone, then join each kid's tablet with a code.</p>
      <div class="row wrap">
        <button class="btn" data-action="family-create">Start a family</button>
        <button class="btn ghost" data-action="family-join">Join with a code</button>
      </div>
    </div>`;
  }
  const who = cloudCfg.role === 'kid' ? `${esc(kidById(cloudCfg.kidId)?.name || 'A kid')}'s device` : `a parent (${esc(cloudCfg.email || 'signed in')})`;
  const status = cloud.signedOut ? '⚠️ This device was signed out of the family. Stop syncing, then join again with a new code.'
    : cloud.error ? `⚠️ Sync problem: ${esc(cloud.error)}`
      : cloud.pending ? `⏳ ${navigator.onLine ? 'Saving to the cloud…' : 'Offline. Changes are kept here and will sync when back online.'}`
        : '✅ Synced';
  return `
    <div class="card">
      <h2>Family sync</h2>
      <p class="small">This device syncs with your family as ${who}.</p>
      <p class="muted small">${status}</p>
      ${cloudCfg.role === 'parent' ? `
      <div class="row wrap">
        <button class="btn" data-action="family-invite-kid">Add a kid's device</button>
        <button class="btn ghost" data-action="family-invite-parent">Add a parent</button>
      </div>` : ''}
      <button class="btn ghost" data-action="family-leave">Stop syncing on this device</button>
    </div>`;
}

// A plain reason for a Firebase error, plus its code so a parent can pass it on.
function cloudProblem(err, fallback) {
  const code = err?.code || '';
  const why = code === 'permission-denied' ? 'The family database turned this down. The Firestore security rules may not be published yet (Firebase console › Firestore › Rules).'
    : code === 'unavailable' || !navigator.onLine ? 'Could not reach the cloud. Check the Wi-Fi and try again.'
      : code.startsWith('auth/') ? 'Google sign-in did not finish. Check that Google sign-in is turned on and this site is an authorized domain in Firebase.'
        : fallback;
  return code ? `${why} (${code})` : why;
}

function busyModal(text) {
  openModal(`<div data-sticky class="celebrate"><h2>${esc(text)}</h2><p class="muted">Keep the app open.</p></div>`);
}

function errorModal(title, text) {
  openModal(`
    <div class="celebrate">
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <button class="btn" data-action="modal-close">OK</button>
    </div>`);
}

// Switch this device to the family and restart the app on the cloud copy.
function finishJoin(cfg, cacheState) {
  localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg));
  if (cacheState) localStorage.setItem(CLOUD_CACHE_KEY, JSON.stringify(cacheState));
  else localStorage.removeItem(CLOUD_CACHE_KEY);
  window.location.reload();
}

async function familyCreate() {
  if (!navigator.onLine) { errorModal('You are offline', 'Connect to Wi-Fi to start a family.'); return; }
  let mod;
  let user;
  try {
    mod = await loadCloud();
    user = await mod.signInParent();
  } catch (err) {
    console.error(err);
    errorModal('Sign-in did not finish', `Try again. If no Google window appears, allow pop-ups for this site.${err?.code ? ` (${err.code})` : ''}`);
    return;
  }
  try {
    busyModal('Checking your account…');
    const existing = await mod.findFamily();
    closeModal();
    if (existing) {
      confirmModal({
        title: 'You already have a family',
        text: `${user.email} is already in a family. Connect this device to it as a parent? This device's own data stays saved here and is not uploaded.`,
        yes: 'Connect',
        onYes: () => finishJoin({ ...existing, email: user.email }, null),
      });
      return;
    }
    confirmModal({
      title: 'Start a family?',
      text: `This uploads this device's settings, parent PIN${state.kids.length ? ` and ${state.kids.map((k) => k.name).join(', ')}` : ''} to your family's cloud, signed in as ${user.email}. A backup file is saved first.`,
      yes: 'Start family',
      onYes: async () => {
        actions.export();
        busyModal('Uploading…');
        try {
          const cfg = await mod.createFamily(state);
          finishJoin({ ...cfg, email: user.email }, state);
        } catch (err) {
          console.error(err);
          closeModal();
          if (err?.code === 'permission-denied') {
            errorModal('This account can’t start a family', `Only Google accounts on the family’s allowed list can start a family. If you are already in a family, ask a parent for a code instead. (${user.email})`);
          } else {
            errorModal('That did not work', `Nothing changed on this device. ${cloudProblem(err, 'Try again in a moment.')}`);
          }
        }
      },
    });
  } catch (err) {
    console.error(err);
    closeModal();
    errorModal('That did not work', cloudProblem(err, 'Check the connection and try again.'));
  }
}

function familyJoin() {
  openModal(`
    <div class="celebrate">
      <h2>Join your family</h2>
      <p class="muted">On a parent's device, open Parents › Settings › Family sync and tap "Add a kid's device" or "Add a parent" to get a code.</p>
      <input class="code-input" data-join-code autocomplete="off" autocapitalize="characters" placeholder="Code" maxlength="12">
      <div class="stack">
        <button class="btn huge" data-action="family-join-go">Join</button>
        <button class="btn ghost" data-action="modal-close">Cancel</button>
      </div>
    </div>`);
  loadCloud().catch(() => {});
  setTimeout(() => $modal.querySelector('[data-join-code]')?.focus(), 50);
}

async function familyJoinGo() {
  const input = $modal.querySelector('[data-join-code]');
  let mod;
  try { mod = await loadCloud(); } catch { errorModal('You are offline', 'Connect to Wi-Fi and try again.'); return; }
  const code = mod.normalizeCode(input?.value);
  const role = mod.codeRole(code);
  if (!role || code.length < 6) { toast('That code doesn’t look right. Check it and try again.'); return; }
  if (role === 'kid' && state.kids.length > 1) {
    errorModal('More than one kid here', 'A kid’s device should hold just that kid. Use this device as a parent instead, or remove the extra kids first.');
    return;
  }
  let user;
  try {
    user = role === 'parent' ? await mod.signInParent() : await mod.signInDevice();
  } catch (err) {
    console.error(err);
    errorModal('Sign-in did not finish', `Try again. If no Google window appears, allow pop-ups for this site.${err?.code ? ` (${err.code})` : ''}`);
    return;
  }
  if (role === 'kid' && state.kids.length) actions.export();
  busyModal(role === 'kid' && state.kids.length ? `Uploading ${state.kids[0].name}'s progress…` : 'Joining…');
  try {
    const cfg = await mod.joinFamily(code, state);
    finishJoin({ ...cfg, email: role === 'parent' ? user.email : null }, role === 'kid' && state.kids.length ? state : null);
  } catch (err) {
    console.error(err);
    closeModal();
    const msg = err.code === 'bad-code' ? 'That code is wrong or has expired. Ask for a new one.'
      : err.code === 'which-kid' ? err.message
        : err.code === 'check-failed' ? 'The upload did not check out, so this device keeps using its own copy. Try again later.'
          : `Nothing changed on this device. ${cloudProblem(err, 'Check the connection and try again.')}`;
    errorModal('Could not join', msg);
  }
}

async function familyInvite(role) {
  let kidId = null;
  if (role === 'kid') {
    openModal(`
      <div class="celebrate">
        <h2>Add a kid's device</h2>
        <p class="muted">Whose device is it?</p>
        <div class="stack">
          <button class="btn" data-action="family-invite-for" data-kid="">A kid whose progress is on that device</button>
          ${state.kids.map((k) => `<button class="btn ghost" data-action="family-invite-for" data-kid="${k.id}">${esc(k.name)} (already in the family)</button>`).join('')}
          <button class="btn ghost" data-action="modal-close">Cancel</button>
        </div>
      </div>`);
    return;
  }
  showCode(role, kidId);
}

async function showCode(role, kidId) {
  busyModal('Making a code…');
  try {
    const mod = await loadCloud();
    const code = await mod.makeJoinCode(cloudCfg.familyId, role, kidId);
    const pretty = `${code.slice(0, 4)}-${code.slice(4)}`;
    closeModal();
    openModal(`
      <div class="celebrate">
        <h2>Join code</h2>
        <p class="join-code">${pretty}</p>
        <p class="muted">${role === 'parent'
    ? 'On the other parent’s phone, open Kid Quest, tap "Join your family with a code" (or Parents › Settings › Family sync), enter this code, and sign in with Google.'
    : 'On the kid’s device, open Kid Quest, go to Parents › Settings › Family sync, tap "Join with a code" and enter this code.'} It works for 30 minutes.</p>
        <button class="btn" data-action="modal-close">Done</button>
      </div>`);
  } catch (err) {
    console.error(err);
    closeModal();
    errorModal('Could not make a code', cloudProblem(err, 'Try again in a moment.'));
  }
}

function familyLeave() {
  confirmModal({
    title: 'Stop syncing on this device?',
    text: 'This device goes back to the copy it had before joining. Everything stays safe in the family cloud, and you can join again with a new code.',
    yes: 'Stop syncing', danger: true,
    onYes: async () => {
      try {
        const mod = await loadCloud();
        mod.stopSync();
        await mod.signOutDevice();
      } catch { /* offline: still leave */ }
      localStorage.removeItem(CLOUD_KEY);
      localStorage.removeItem(CLOUD_CACHE_KEY);
      window.location.reload();
    },
  });
}

Object.assign(actions, {
  'family-create': () => familyCreate(),
  'family-join': () => familyJoin(),
  'family-join-go': () => familyJoinGo(),
  'family-invite-kid': () => familyInvite('kid'),
  'family-invite-parent': () => familyInvite('parent'),
  'family-invite-for': (el) => { closeModal(); showCode('kid', el.dataset.kid || null); },
  'family-leave': () => familyLeave(),
});

// Visitors take turns talking, one speech bubble at a time. Tapping one makes it talk.
function nextVisitorTalks(pick) {
  const all = [...document.querySelectorAll('.map-visitor')];
  if (all.length < 2 && !pick) return;
  const now = all.findIndex((el) => el.classList.contains('talking'));
  const next = pick || all[(now + 1) % all.length];
  all.forEach((el) => el.classList.toggle('talking', el === next));
}
setInterval(() => { if (document.visibilityState === 'visible') nextVisitorTalks(); }, 4000);
actions.visitor = (el) => {
  const v = familyBuddies().find((b) => b.id === el.dataset.id);
  const kid = kidById(el.closest('.map-visitors')?.dataset.host);
  // once the day's quest is done, visitors want to play
  if (v && kid) {
    const s = dayStatus(state, kid, today(), today());
    if (s.complete) { sounds.tap(); playWith(kid, v); return; }
    const left = s.total - s.done;
    el.querySelector('.visitor-bubble').textContent = `Finish your quest and let's play! ${left} to go`;
  }
  nextVisitorTalks(el);
  if (!v || !doMove(el, v)) sounds.tap();
};

// ---------- playing with a visitor ----------
// A ball game when the visitor owns a ball, tag when not. Best scores live on the kid (kid.playBest).
function playWith(kid, v) {
  const gear = bestGear(v.owned);
  const kind = gameFor(gear);
  const best = kid.playBest?.[kind] || 0;
  openPlay({
    kind,
    best,
    kid: { buddy: kid.buddy, name: kid.name, gear: bestGear(kid.owned || []) },
    visitor: { buddy: v.buddy, name: v.name, gear },
    sounds,
    onScore: (score) => {
      kid.playBest = { ...(kid.playBest || {}), [kind]: score };
      save();
    },
  });
}

// Fishing visitors now and then reel in something from the pond: what bites depends on the map.
function fishBite() {
  const fishers = [...document.querySelectorAll('.map-visitor.fishing:not(.reeling)')].filter((el) => !el.dataset.moving);
  if (!fishers.length) return;
  const el = fishers[Math.floor(Math.random() * fishers.length)];
  const theme = el.closest('.quest-map')?.dataset.theme;
  const got = catchFor(theme, Number(el.dataset.rod) || 1);
  const $catch = el.querySelector('.fish-catch');
  $catch.innerHTML = got.svg;
  el.classList.add('reeling');
  setTimeout(() => {
    if (!el.isConnected) return;
    el.querySelector('.visitor-bubble').textContent = `${got.rare ? 'WOW! ' : ''}I caught ${/^[aeiou]/.test(got.name) ? 'an' : 'a'} ${got.name}! ${got.icon}`;
    nextVisitorTalks(el);
  }, 900);
  setTimeout(() => el.classList.remove('reeling'), 3400);
}
setInterval(() => { if (document.visibilityState === 'visible' && Math.random() < 0.6) fishBite(); }, 6000);

// ---------- sports moves ----------

const lastMove = new Map();

/**
 * Tap a buddy and it does one of its unlocked moves at random. el holds the
 * buddy's <svg>; who is { buddy, owned, exBest }. Returns false (and does
 * nothing) when the buddy has no moves yet or is already mid-move.
 * pick: a move id to do instead of a random one.
 */
function doMove(el, who, pick = null) {
  const svg = el.querySelector('svg.buddy-svg');
  const canvas = el.querySelector('canvas.live-buddy');
  if ((!svg && !canvas) || el.dataset.moving) return false;
  const moves = unlockedMoves(who.owned, who.exBest);
  const choice = pick ? moves.find((m) => m.move.id === pick) : pickMove(moves, lastMove.get(el.dataset.id || el.dataset.kid));
  if (!choice) return false;
  lastMove.set(el.dataset.id || el.dataset.kid, choice.move.id);
  const host = (svg || canvas).parentElement;
  const before = host.innerHTML;
  const opts = { background: svg ? Boolean(svg.querySelector('.bg')) : canvas.dataset.bg !== '0', trick: { move: choice.move.id, kind: choice.move.kind, tier: choice.tier } };
  // a fishing visitor keeps facing the pond
  const buddy = el.classList.contains('fishing') ? { ...who.buddy, outfit: { ...who.buddy.outfit, sport: undefined } } : who.buddy;
  // a live buddy steps aside for the move's drawing, then carries on where it was
  if (canvas) { canvas.hidden = true; host.insertAdjacentHTML('beforeend', buddySvg(buddy, 'excited', opts)); } else host.innerHTML = buddySvg(buddy, 'excited', opts);
  el.dataset.moving = '1';
  el.classList.add('doing-move');
  sounds.move?.(choice.move.kind);
  floatText(`${choice.move.name}!`, el);
  setTimeout(() => {
    delete el.dataset.moving;
    el.classList.remove('doing-move');
    if (canvas) { host.querySelector('svg.trick')?.remove(); canvas.hidden = false; } else if (host.isConnected) host.innerHTML = before;
  }, MOVE_ART[choice.move.id].ms + 80);
  return true;
}

let moveHintShown = false;
actions['buddy-move'] = (el) => {
  const kid = kidById(el.dataset.kid);
  if (!kid) return;
  // a live buddy reacts to where it was tapped: a pat on the head (or lots of quick taps) is
  // handled in live.js; a tap on the body does a sports move, or a giggle with no moves yet
  const zone = el.querySelector('canvas.live-buddy')?.dataset.zone;
  if (zone === 'head' || zone === 'silly') { sounds.tap(); return; }
  if (doMove(el, mover(kid), el.dataset.move || null)) return;
  if (el.dataset.moving) return;
  sounds.tap();
  if (zone) { live(liveKey(kid)).giggle(); if (moveHintShown) return; moveHintShown = true; }
  const ex = exerciseInfo(kid);
  toast(`Exercise ${ex.goal} days in one week to learn your first move! 💪`);
};

// ---------- reminders and day rollover ----------

let lastDay = today();
const fired = new Set();

setInterval(() => {
  const t = today();
  if (t !== lastDay) { lastDay = t; if (ui.view !== 'timer') render(); }
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (const r of state.settings.reminders) {
    const id = `${t} ${r}`;
    if (r !== hhmm || fired.has(id)) continue;
    fired.add(id);
    const waiting = state.kids.filter((k) => !dayStatus(state, k, t, t).complete);
    if (!waiting.length) continue;
    const title = now.getHours() < 12 ? 'Morning quest time! 🌅' : 'Quest time! ☀️';
    const body = `${waiting.map((k) => k.name).join(', ')}: your tasks are waiting.`;
    if (document.visibilityState === 'visible') {
      sounds.reminder();
      toast(`${title} ${body}`);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'reminder' })).catch(() => {});
    }
  }
}, 15000);

// ---------- start ----------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // The service worker serves the cached app first, so after a new version is deployed the
  // first open still shows the old one. When the new worker takes over, reload once to show it,
  // unless a piano timer is on screen (then the next open picks it up).
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || ui.view === 'timer') return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update()).catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

restoreTimer();
render();
startEars();
if (cloudCfg) startCloud();

// Exposed for debugging in the browser console only.
window.kidQuest = { get state() { return state; }, save, get cloud() { return cloud; } };
