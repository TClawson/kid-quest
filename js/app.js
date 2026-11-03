import {
  DAY_NAMES, defaultTasks, dateKey, addDays, parseKey, newId, entryFor,
  tasksForDay, snapshotToday, dayStatus, streakInfo, totalXp, totalCoins, levelFor, taskXp, taskCoins,
  defaultReward, parseReward, MAX_REWARD,
  pendingApprovals, fallbackHash, pianoStreakInfo,
  isExercise, taskGems, totalGems, exerciseStreakInfo, DEFAULT_GEMS, EXERCISE_DAYS,
} from './logic.js';
import { sounds, confetti, setSound } from './fx.js';
import { buddySvg, buddyLine, MOVE_ART, catchFor, ballSvg } from './avatar.js';
import { paintQuestMaps, mapTheme } from './maparts.js';
import { startMusic, stopMusic } from './music.js';
import {
  SPECIES, SLOTS, ITEMS, itemById, isUnlocked, needLabel, needGap, pianoDaysNeeded, newUnlocks, LEGACY_LEVEL, defaultBuddy, restingMood, isWorn, ownedFor, addOwned, fitsSpecies, moveWornToBuddy, switchSpecies,
  SPORTS, MOVES, unlockedMoves, pickMove, moveWeeks, bestGear,
} from './items.js';
import { pickVisitors, visitorLines, planVisits } from './visits.js';
import { runSeconds, CHEERS, pickCheer } from './practice.js';
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

/** Animated buddy. size: css class for sizing. */
function buddyHtml(kid, mood, size = 'lg', opts = {}) {
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
  const xp = taskXp(task);
  const coins = taskCoins(task);
  const gems = taskGems(task);
  floatText([gems && `+${gems} 💎`, xp && `+${xp} XP`, coins && `+${coins} 🪙`].filter(Boolean).join(' · ') || 'Done!', anchor);
  ui.cheerUntil = Date.now() + 2600;
  ui.cheerKid = kid.id;
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
  if (document.visibilityState !== 'visible') { leaveTimer(); stopMusic(); }
  if (document.visibilityState === 'visible') { returnToTimer(); render(); }
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
        ${buddyHtml(kid, moodFor(kid), 'md')}
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
      look = { ...v.buddy, outfit: { ...v.buddy.outfit, sport: `sport-rod-${version(gear.rod)}` } };
      cls = `fishing face-${spot.side}`;
      data = `data-rod="${gear.rod}"`;
      extra = '<div class="fish-line" aria-hidden="true"><span class="bobber"></span></div><div class="fish-catch" aria-hidden="true"></div>';
    } else if (area) {
      // playing a game: the one nearer the left edge is player a. Sticks are held, balls are shared.
      const a = x === Math.min(...area.members.map((id) => GX[plan.spots[id].side][plan.spots[id].slot]));
      const outfit = { ...v.buddy.outfit, sport: area.kind === 'hockey' ? `sport-hockey-${version(gear.hockey)}` : undefined };
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
  return { html: `<div class="map-visitors ${arrive ? 'arrive' : ''}" aria-label="Visiting buddies">${games}${html}</div>`, room: VILLAGE, areas };
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
      ${buddyHtml(kid, mood === 'sad' || mood === 'sleepy' ? mood : mood === 'proud' ? 'proud' : mood === 'excited' ? 'excited' : 'happy', 'mini', { background: false })}
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
        <button class="buddy-tap" data-action="buddy-move" data-kid="${kid.id}" aria-label="Tap ${esc(kid.name)}'s buddy to see a move">${buddyHtml(kid, mood, 'lg')}</button>
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
        <p class="muted small">Finish 7 days in a row to earn a streak freeze ❄️ (you can save up to 2). A freeze protects your streak if you miss a day. Best streak: ${info.best} days.</p>
      </section>
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
  const tip = task.background
    ? 'You can switch to another app, like Note Rush. The timer keeps counting. Come back here when you’re done.'
    : 'Keep the tablet near the piano with this screen open. The timer pauses if you leave the app.';
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
            <small>${timer.running ? 'Keep playing! 🎶' : done ? 'Paused' : 'Ready?'}</small>
          </div>
        </div>
        <button class="timer-buddy ${timer.running ? 'bobbing' : ''}" data-action="timer-buddy" aria-label="Tap ${esc(kid.name)}'s buddy for a cheer">
          <span class="timer-bubble" aria-live="polite"></span>
          <span class="timer-sprite">${buddySvg(kid.buddy, 'happy', { background: false })}</span>
        </button>
      </div>
      <button class="btn huge" data-action="${timer.running ? 'timer-pause' : 'timer-start'}">${timer.running ? 'Pause' : done ? 'Keep going' : 'Start practice'}</button>
      <p class="muted small">${tip}</p>
    </div>`;
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
        <button class="buddy-tap" data-action="buddy-move" data-kid="${kid.id}" aria-label="Tap for a move">${buddyHtml(kid, 'happy', 'lg')}</button>
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
  return `
    <div class="list">
      ${state.kids.map((kid) => `
        <div class="list-row">
          ${buddyChip(kid)}
          <div class="grow"><b>${esc(kid.name)}</b><small class="muted">${kid.tasks.length} tasks</small></div>
          <button class="btn ghost" data-action="edit-kid" data-id="${kid.id}">Edit</button>
        </div>`).join('') || '<p class="muted">No kids yet.</p>'}
    </div>
    ${cloudCfg?.role === 'kid' ? '' : '<button class="btn" data-action="add-kid">+ Add a kid</button>'}
    <p class="muted small">New kids start with the standard routine: morning teeth, bed and floor; piano Monday to Friday; chore of the week Monday to Thursday; deep clean, vacuum and dust on Friday; laundry on Saturday. Change any of it per kid.</p>`;
}

function dayChips(task) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => `<button class="daychip ${task.days.includes(d) ? 'on' : ''}" data-action="toggle-day" data-task="${task.id}" data-day="${d}">${DAY_NAMES[d]}</button>`).join('');
}

function parentEditKid() {
  const kid = kidById(ui.editKidId);
  if (!kid) { ui.editKidId = null; return parentKids(); }
  const taskRows = (period) => kid.tasks.filter((t) => t.period === period).map((t) => `
    <div class="task-edit" data-task="${t.id}">
      <div class="row">
        <input class="icon-input" data-field="icon" value="${esc(t.icon)}" aria-label="Icon">
        <input class="grow" data-field="name" value="${esc(t.name)}" aria-label="Task name">
        <button class="btn ghost round" data-action="move-task" data-task="${t.id}" data-dir="-1" aria-label="Move up">↑</button>
        <button class="btn ghost round" data-action="move-task" data-task="${t.id}" data-dir="1" aria-label="Move down">↓</button>
        <button class="btn ghost round danger-text" data-action="delete-task" data-task="${t.id}" aria-label="Delete">✕</button>
      </div>
      <div class="days">${dayChips(t)}</div>
      <div class="row wrap">
        <label>When <select data-field="period"><option value="morning" ${t.period === 'morning' ? 'selected' : ''}>Morning</option><option value="afternoon" ${t.period === 'afternoon' ? 'selected' : ''}>After school</option><option value="exercise" ${t.period === 'exercise' ? 'selected' : ''}>Bonus exercise</option></select></label>
        <label>Checked by <select data-field="verify"><option value="self" ${t.verify === 'self' ? 'selected' : ''}>Kid taps done</option><option value="parent" ${t.verify === 'parent' ? 'selected' : ''}>Parent PIN</option></select></label>
        <label>Timer <input type="number" min="0" max="180" step="5" data-field="minutes" value="${t.minutes}" class="num"> min</label>
        ${t.minutes > 0 ? `<label class="row"><input type="checkbox" data-field="background" ${t.background ? 'checked' : ''}> Keep counting in other apps</label>` : ''}
      </div>
      ${isExercise(t) ? `<div class="row wrap reward-edit">
        <label>Earns 💎 <input type="number" min="0" max="${MAX_REWARD}" step="1" data-field="gems" value="${Number.isFinite(t.gems) ? t.gems : ''}" placeholder="${DEFAULT_GEMS}" class="num" aria-label="Gems earned"> gems</label>
        <label>and <input type="number" min="0" max="${MAX_REWARD}" step="1" data-field="xp" value="${Number.isFinite(t.xp) ? t.xp : ''}" placeholder="${defaultReward(t)}" class="num" aria-label="XP earned"> XP</label>
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
    <p class="muted small">Changes apply from today. Past days keep the tasks they had. A timer task (like piano) counts minutes only while the app is open, unless you tick “Keep counting in other apps” (for an app like Note Rush). Time spent in other apps shows when you approve it. Each task earns 10 coins and 10 XP (30 for a timer task) unless you type other amounts; leave a box empty to use the default. A new amount counts from today, so coins already earned stay earned. Every 100 XP is a level.</p>
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

/** Switch buddies. Each buddy remembers what it was wearing; bought hats and such stay with the buddy they were bought for. */
function changeSpecies(kid, species) {
  const prog = progressFor(kid);
  switchSpecies(kid, species, (item, sp) => fitsSpecies(item, sp) && isUnlocked(item, { ...prog, owned: ownedFor(kid, sp) }));
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

const views = { setup: viewSetup, home: viewHome, kid: viewKid, timer: viewTimer, parent: viewParent, wardrobe: viewWardrobe };

// Rows that scroll sideways (wardrobe tabs, buddy picker...) keep their place when the screen is redrawn.
const SIDE_SCROLLERS = '.tabs, .pick';
let lastHtml = '';
let lastView = '';

function render() {
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
  'timer-start': () => startTimer(),
  'timer-pause': () => stopTimer(),
  'timer-buddy': () => buddyCheer(),
  'timer-back': () => { stopTimer(false); ui.view = 'kid'; render(); },
  parent: () => pinPad({ title: 'Parents only', subtitle: 'Type the parent PIN', onSuccess: () => { ui.view = 'parent'; ui.tab = pendingApprovals(state, today()).length ? 'approvals' : ui.tab; render(); } }),
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
    else outfit[item.slot] = item.id;
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
  'modal-close': () => closeModal(),
  'modal-yes': () => { const cb = modalYes; modalYes = null; closeModal(); cb?.(); },
};

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
    if (v === null) delete task[el.dataset.field];
    else task[el.dataset.field] = v;
    save();
    if (el.tagName === 'SELECT' || el.dataset.field === 'minutes' || isReward) render();
    return;
  }
  if (el.dataset.kidfield) { kidById(ui.editKidId)[el.dataset.kidfield] = el.value.trim() || 'Kid'; save(); render(); return; }
  if (el.dataset.setting) { state.settings[el.dataset.setting] = el.value; save(); return; }
  if (el.dataset.settingBool) { state.settings[el.dataset.settingBool] = el.checked; setSound(el.checked); save(); return; }
  if (el.dataset.reminder) { state.settings.reminders[Number(el.dataset.reminder)] = el.value; save(); return; }
  const act = el.dataset.actionChange;
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
  nextVisitorTalks(el);
  const v = familyBuddies().find((b) => b.id === el.dataset.id);
  if (!v || !doMove(el, v)) sounds.tap();
};

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
  if (!svg || el.dataset.moving) return false;
  const moves = unlockedMoves(who.owned, who.exBest);
  const choice = pick ? moves.find((m) => m.move.id === pick) : pickMove(moves, lastMove.get(el.dataset.id || el.dataset.kid));
  if (!choice) return false;
  lastMove.set(el.dataset.id || el.dataset.kid, choice.move.id);
  const host = svg.parentElement;
  const before = host.innerHTML;
  const opts = { background: Boolean(svg.querySelector('.bg')), trick: { move: choice.move.id, kind: choice.move.kind, tier: choice.tier } };
  // a fishing visitor keeps facing the pond
  const buddy = el.classList.contains('fishing') ? { ...who.buddy, outfit: { ...who.buddy.outfit, sport: undefined } } : who.buddy;
  host.innerHTML = buddySvg(buddy, 'excited', opts);
  el.dataset.moving = '1';
  el.classList.add('doing-move');
  sounds.move?.(choice.move.kind);
  floatText(`${choice.move.name}!`, el);
  setTimeout(() => {
    delete el.dataset.moving;
    el.classList.remove('doing-move');
    if (host.isConnected) host.innerHTML = before;
  }, MOVE_ART[choice.move.id].ms + 80);
  return true;
}

actions['buddy-move'] = (el) => {
  const kid = kidById(el.dataset.kid);
  if (!kid) return;
  if (doMove(el, mover(kid), el.dataset.move || null)) return;
  if (el.dataset.moving) return;
  sounds.tap();
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
if (cloudCfg) startCloud();

// Exposed for debugging in the browser console only.
window.kidQuest = { get state() { return state; }, save, get cloud() { return cloud; } };
