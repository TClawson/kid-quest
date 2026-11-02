import {
  DAY_NAMES, emptyState, defaultTasks, dateKey, addDays, parseKey, newId, entryFor,
  tasksForDay, snapshotToday, dayStatus, streakInfo, totalXp, levelFor, taskXp,
  pendingApprovals, fallbackHash,
} from './logic.js';
import { sounds, confetti, setSound } from './fx.js';
import { buddySvg, buddyLine } from './avatar.js';
import {
  SPECIES, SLOTS, ITEMS, itemById, isUnlocked, needLabel, newUnlocks, speciesFromEmoji, defaultBuddy, restingMood,
} from './items.js';

const STORAGE_KEY = 'kidquest.v1';
const COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac'];

// ---------- storage ----------

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
    // fall through to a fresh state
  }
  return emptyState();
}

function migrate(s) {
  const base = emptyState();
  const kids = (s.kids || []).map((k) => ({
    ...k,
    buddy: k.buddy || defaultBuddy(speciesFromEmoji(k.avatar)),
    seenUnlocks: k.seenUnlocks || [],
  }));
  return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, log: s.log || {}, kids, celebrations: s.celebrations || {} };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    toast('Could not save. Is storage full?');
  }
}

let state = load();
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
  const lv = levelFor(totalXp(state, kid, t));
  return { ...info, level: lv.level, into: lv.into };
}

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
  floatText(`+${taskXp(task)} XP`, anchor);
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

const timer = { running: false, interval: null, wakeLock: null };

async function startTimer() {
  timer.running = true;
  try {
    timer.wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    timer.wakeLock = null;
  }
  clearInterval(timer.interval);
  timer.interval = setInterval(tickTimer, 1000);
  render();
}

function stopTimer(rerender = true) {
  timer.running = false;
  clearInterval(timer.interval);
  timer.interval = null;
  timer.wakeLock?.release?.().catch(() => {});
  timer.wakeLock = null;
  if (rerender && ui.view === 'timer') render();
}

function tickTimer() {
  if (ui.view !== 'timer' || document.visibilityState !== 'visible') return;
  const kid = kidById(ui.kidId);
  const task = taskById(kid, today(), ui.taskId);
  if (!kid || !task) return stopTimer();
  const entry = entryFor(state, kid.id, today(), true);
  const cur = entry.tasks[task.id] || { status: 'inprogress', seconds: 0 };
  cur.seconds = Math.min(task.minutes * 60, (cur.seconds || 0) + 1);
  if (!cur.status) cur.status = 'inprogress';
  entry.tasks[task.id] = cur;
  save();
  const left = task.minutes * 60 - cur.seconds;
  const $t = document.getElementById('timer-left');
  const $ring = document.getElementById('timer-ring');
  if ($t) $t.textContent = mmss(left);
  if ($ring) $ring.style.setProperty('--p', cur.seconds / (task.minutes * 60));
  if (left <= 0) {
    stopTimer(false);
    cur.status = 'inprogress';
    save();
    sounds.day();
    confetti(80, 1800);
    ui.view = 'kid';
    render();
    if (task.verify === 'self') markDone(kid, task, 'self');
    else askParentNowOrLater(kid, task);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' && timer.running) stopTimer();
  if (document.visibilityState === 'visible') render();
});

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

  const top = 70;
  const pts = rows.map((r, i) => ({ x: 50 + (r.type === 'task' || r.type === 'chest' ? MAP_WAVE[i % MAP_WAVE.length] : 0), y: top + i * MAP_ROW }));
  const height = top + rows.length * MAP_ROW;
  const pathD = (upto) => pts.slice(0, upto + 1).map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const q = pts[i - 1];
    const my = (q.y + p.y) / 2;
    return `C ${q.x} ${my}, ${p.x} ${my}, ${p.x} ${p.y}`;
  }).join(' ');

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
  const walker = `<div class="map-buddy ${mood === 'excited' ? 'hop' : ''}" style="left:${hp.x}%;top:${hp.y}px">
      ${buddyHtml(kid, mood === 'sad' || mood === 'sleepy' ? mood : mood === 'proud' ? 'proud' : mood === 'excited' ? 'excited' : 'happy', 'mini', { background: false })}
    </div>`;

  return `
    <section class="quest-map" style="height:${height}px">
      <svg class="map-path" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${pathD(rows.length - 1)}" class="road"/>
        <path d="${pathD(here)}" class="road-done"/>
        <path d="${pathD(rows.length - 1)}" class="road-dash"/>
      </svg>
      <div class="map-start" style="left:50%;top:0">🚩 Start</div>
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
  return `
    <div class="screen kid" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="home" aria-label="Back">←</button>
        <div class="kid-title"><b>${esc(kid.name)}</b><small>Level ${lv.level} · <span class="xpbar"><span style="width:${lv.into}%"></span></span></small></div>
        <div class="chips">
          <span class="chip fire ${info.streak ? '' : 'cold'}" title="Streak">🔥 ${info.streak}</span>
          <span class="chip ice" title="Streak freezes">❄️ ${info.freezes}</span>
        </div>
      </header>
      <div class="buddy-panel">
        ${buddyHtml(kid, mood, 'lg')}
        <div class="buddy-side">
          <div class="bubble">${esc(buddyLine(mood, kid.name))}</div>
          <div class="quest-progress">
            <div class="bar big"><span style="width:${pct}%"></span></div>
            <div>${s.complete ? '<b>Quest complete! 🌟</b>' : `<b>${s.done} of ${s.total}</b> done${s.pending ? ` · ${s.pending} waiting for a parent` : ''}`}</div>
          </div>
          <button class="btn ghost" data-action="wardrobe">👕 Dress up ${esc(kid.name)}'s buddy${newCount ? ` <span class="badge">new</span>` : ''}</button>
        </div>
      </div>
      <div class="view-toggle">
        <button class="${listMode ? '' : 'on'}" data-action="quest-mode" data-mode="map">🗺️ Map</button>
        <button class="${listMode ? 'on' : ''}" data-action="quest-mode" data-mode="list">📋 List</button>
      </div>
      ${listMode ? `${section('morning', '🌅 Morning', state.settings.morningBy)}
      ${section('afternoon', '☀️ After school', state.settings.bedtime)}` : questMap(kid, s, entry, mood)}
      <section>
        <h2>This week</h2>
        ${weekDots(kid, info)}
        <p class="muted small">Finish 7 days in a row to earn a streak freeze ❄️ (you can save up to 2). A freeze protects your streak if you miss a day. Best streak: ${info.best} days.</p>
      </section>
    </div>`;
}

function viewTimer() {
  const kid = kidById(ui.kidId);
  const task = kid && taskById(kid, today(), ui.taskId);
  if (!task) { ui.view = 'kid'; return viewKid(); }
  const done = entryFor(state, kid.id, today())?.tasks?.[task.id]?.seconds || 0;
  const total = task.minutes * 60;
  return `
    <div class="screen timer center" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="timer-back" aria-label="Back">←</button>
        <div class="kid-title"><b>${esc(task.icon)} ${esc(task.name)}</b><small>${esc(kid.name)}</small></div>
      </header>
      <div class="ring" id="timer-ring" style="--p:${done / total}">
        <div class="ring-inner">
          <div class="timer-left" id="timer-left">${mmss(total - done)}</div>
          <small>${timer.running ? 'Keep playing! 🎶' : done ? 'Paused' : 'Ready?'}</small>
        </div>
      </div>
      <button class="btn huge" data-action="${timer.running ? 'timer-pause' : 'timer-start'}">${timer.running ? 'Pause' : done ? 'Keep going' : 'Start practice'}</button>
      <p class="muted small">Keep the tablet near the piano with this screen open. The timer pauses if you leave the app.</p>
    </div>`;
}

function viewWardrobe() {
  const kid = kidById(ui.kidId);
  if (!kid) { ui.view = 'home'; return viewHome(); }
  const prog = progressFor(kid);
  const fresh = new Set(kid.newItems || []);
  const items = ITEMS.filter((i) => i.slot === ui.slot);
  const nextItem = ITEMS.filter((i) => !isUnlocked(i, prog)).sort((a, b) => (a.need.streak ? a.need.streak - prog.best : (a.need.level - prog.level) * 1.5) - (b.need.streak ? b.need.streak - prog.best : (b.need.level - prog.level) * 1.5))[0];
  return `
    <div class="screen wardrobe" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="wardrobe-back" aria-label="Back">←</button>
        <div class="kid-title"><b>${esc(kid.name)}'s buddy</b><small>Best streak ${prog.best} days · Level ${prog.level}</small></div>
      </header>
      <div class="wardrobe-top">
        ${buddyHtml(kid, 'happy', 'lg')}
        <div class="buddy-side">
          <div class="pick">${SPECIES.map((sp) => `<button class="pick-item species ${kid.buddy.species === sp.id ? 'on' : ''}" data-action="wardrobe-species" data-val="${sp.id}" aria-label="${sp.name}">${buddySvg({ species: sp.id }, 'happy', { background: false })}</button>`).join('')}</div>
          ${nextItem ? `<p class="muted">Next unlock: <b>${esc(nextItem.name)}</b> at ${esc(needLabel(nextItem))}</p>` : '<p class="muted">You unlocked everything! 🏆</p>'}
        </div>
      </div>
      <nav class="tabs">${SLOTS.map((sl) => `<button class="${ui.slot === sl.id ? 'on' : ''}" data-action="wardrobe-slot" data-slot="${sl.id}">${sl.icon} ${sl.name}</button>`).join('')}</nav>
      <div class="items">
        ${items.map((item) => {
    const open = isUnlocked(item, prog);
    const on = kid.buddy.outfit[item.slot] === item.id;
    const preview = { ...kid.buddy, outfit: item.slot === 'background' ? { background: item.id } : { background: 'none', [item.slot]: item.id } };
    return `<button class="item ${open ? '' : 'locked'} ${on ? 'on' : ''}" data-action="wardrobe-item" data-id="${item.id}">
            <span class="item-art">${buddySvg(preview, 'happy', { background: item.slot === 'background' })}</span>
            <span class="item-name">${esc(item.name)}${fresh.has(item.id) ? ' <span class="badge">new</span>' : ''}</span>
            <small>${open ? (on ? 'Wearing' : 'Tap to wear') : `🔒 ${esc(needLabel(item))}`}</small>
          </button>`;
  }).join('')}
      </div>
      <p class="muted small">Streak items stay yours even if a streak ends. Tap an item again to take it off.</p>
    </div>`;
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

function parentApprovals(pending) {
  if (!pending.length) return '<div class="empty"><p>Nothing to check right now. 🎉</p></div>';
  return `
    <div class="row end"><button class="btn" data-action="approve-all">Approve all (${pending.length})</button></div>
    <div class="list">
      ${pending.map(({ key, kid, task }) => `
        <div class="list-row">
          ${buddyChip(kid)}
          <div class="grow"><b>${esc(kid.name)}: ${esc(task.icon)} ${esc(task.name)}</b><small class="muted">${esc(friendlyDate(key))}${task.minutes ? ` · ${task.minutes} min timer finished` : ''}</small></div>
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
    <button class="btn" data-action="add-kid">+ Add a kid</button>
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
        <label>When <select data-field="period"><option value="morning" ${t.period === 'morning' ? 'selected' : ''}>Morning</option><option value="afternoon" ${t.period === 'afternoon' ? 'selected' : ''}>After school</option></select></label>
        <label>Checked by <select data-field="verify"><option value="self" ${t.verify === 'self' ? 'selected' : ''}>Kid taps done</option><option value="parent" ${t.verify === 'parent' ? 'selected' : ''}>Parent PIN</option></select></label>
        <label>Timer <input type="number" min="0" max="180" step="5" data-field="minutes" value="${t.minutes}" class="num"> min</label>
      </div>
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
    <p class="muted small">Changes apply from today. Past days keep the tasks they had. A timer task (like piano) counts minutes only while the app is open.</p>
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
        ${s.tasks.map((task) => {
    const st = entry?.tasks?.[task.id]?.status;
    return `<div class="list-row">
            <span>${esc(task.icon)}</span><span class="grow">${esc(task.name)}</span>
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
      <p class="muted small">Everything is saved only on this tablet. Save a backup file now and then (for example to Google Drive) so a reset or new tablet doesn't lose streaks.</p>
      <div class="row wrap">
        <button class="btn" data-action="export">Save backup file</button>
        <label class="btn ghost">Restore from file<input type="file" accept="application/json,.json" data-action-change="import" hidden></label>
      </div>
    </div>`;
}

const views = { setup: viewSetup, home: viewHome, kid: viewKid, timer: viewTimer, parent: viewParent, wardrobe: viewWardrobe };

function render() {
  const scrollY = window.scrollY;
  const keepScroll = ui.view === 'parent' || ui.view === 'wardrobe';
  $app.innerHTML = (views[ui.view] || viewHome)();
  if (keepScroll) window.scrollTo(0, scrollY);
}

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
  'kid-species': (el) => { kidById(ui.editKidId).buddy.species = el.dataset.val; save(); render(); },
  wardrobe: () => { ui.view = 'wardrobe'; render(); window.scrollTo(0, 0); },
  'wardrobe-back': () => { ui.view = 'kid'; render(); },
  'wardrobe-slot': (el) => { ui.slot = el.dataset.slot; render(); },
  'wardrobe-species': (el) => { kidById(ui.kidId).buddy.species = el.dataset.val; sounds.tap(); save(); render(); },
  'wardrobe-item': (el) => {
    const kid = kidById(ui.kidId);
    const item = itemById(el.dataset.id);
    if (!item) return;
    if (!isUnlocked(item, progressFor(kid))) { sounds.error(); toast(`Unlocks at ${needLabel(item)}`); return; }
    const outfit = kid.buddy.outfit;
    if (outfit[item.slot] === item.id && item.slot !== 'background') delete outfit[item.slot];
    else outfit[item.slot] = item.id;
    kid.newItems = (kid.newItems || []).filter((id) => id !== item.id);
    sounds.task(); save(); render();
  },
  'quest-mode': (el) => { state.settings.questView = el.dataset.mode; save(); render(); },
  chest: () => {
    const kid = kidById(ui.kidId);
    const t = today();
    const s = dayStatus(state, kid, t, t);
    if (s.complete) { sounds.day(); confetti(100, 2000); toast('You found the treasure! 🏆'); } else { sounds.tap(); toast(`${s.total - s.done} more to reach the treasure!`); }
  },
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
    kidById(ui.editKidId).tasks.push({ id: newId('task'), name: 'New task', icon: '⭐', period: el.dataset.period, days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0 });
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
    let v = el.value;
    if (el.dataset.field === 'minutes') v = Math.max(0, Math.min(180, Math.round(Number(v) || 0)));
    if (el.dataset.field === 'name' && !v.trim()) v = 'Task';
    task[el.dataset.field] = v;
    save();
    if (el.tagName === 'SELECT') render();
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
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

render();

// Exposed for debugging in the browser console only.
window.kidQuest = { get state() { return state; } };
