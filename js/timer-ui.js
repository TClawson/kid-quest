// The practice timer, listening during practice, and the piano listening test
// (split out of app.js; shared things come from ctx.js).
import { entryFor, tasksForDay, addDays, weekStart, pianoStreakInfo, habitInfo, monthDays, isPianoTask } from './logic.js';
import { sounds, confetti } from './fx.js';
import { buddySvg } from './avatar.js';
import { liveHtml, live, feel } from './live.js';
import { runSeconds, CHEERS, pickCheer, effortCheers } from './practice.js';
import { startListening, buddyState, TUNING } from './listen.js';
import { createBeatFollower } from './beat.js';
import { loadRecognizer } from './hear.js';
import { watchSplit, WATCH_FILLS_CHORE, WATCH_MAX_RUN_MS } from './musicrules.js';
import {
  state, ui, today, esc, kidById, taskById, liveKey, dressed,
  save, render, viewKid, markDone, askParentNowOrLater,
} from './ctx.js';

// ---------- practice timer ----------

// The timer counts from clock times (see practice.js). While it runs, the run is
// also kept in this device's storage, so if Android closes the app in the
// background, opening it again picks the timer back up.
const RUN_KEY = 'kidquest.practiceRun';
// dirty: seconds changed in memory since the last save (saves are spaced out while running)
const timer = { running: false, interval: null, wakeLock: null, run: null, savedAt: 0, dirty: false };
// While the timer runs its seconds go to the family every 15 s, not every tick
// (the count is rebuilt from timer.run anyway). Pausing or finishing saves now.
const TIMER_SAVE_MS = 15000;

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

export function startTimer(tapped = false) {
  if (ui.view === 'watch') { startWatch(tapped); return; }
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

/**
 * Whether a running timer or stopwatch is on screen: redraws from a family update or the
 * day rollover wait then (the page keeps itself up to date while it runs).
 */
export const timerOnScreen = () => (ui.view === 'timer' || (ui.view === 'watch' && timer.running));

export function stopTimer(rerender = true) {
  if (timer.run) syncTimer(true);
  timer.running = false;
  timer.run = null;
  keepRun();
  clearInterval(timer.interval);
  timer.interval = null;
  timer.wakeLock?.release?.().catch(() => {});
  timer.wakeLock = null;
  if (rerender && (ui.view === 'timer' || ui.view === 'watch')) render();
}

// Bring the saved seconds up to the clock. Returns true when the timer is done.
function syncTimer(force = false) {
  const run = timer.run;
  if (run?.watch) { syncWatch(force); return false; }
  const found = runTask();
  if (!found) return false;
  const { kid, task } = found;
  const total = task.minutes * 60;
  const now = Date.now();
  const entry = entryFor(state, kid.id, run.day, true);
  const cur = { status: 'inprogress', ...(entry.tasks[task.id] || {}) };
  const sec = Math.max(cur.seconds || 0, runSeconds(run, now, total));
  let changed = sec !== cur.seconds || !entry.tasks[task.id];
  let urgent = force || !entry.tasks[task.id] || sec >= total;
  if (run.awayFrom != null) {
    // count how much of the timer ran in another app, so a parent can see it
    const away = Math.max(0, sec - run.awayFrom);
    if (away) { cur.away = (cur.away || 0) + away; changed = true; urgent = true; }
    run.awayFrom = null;
    keepRun();
  }
  if (changed) {
    cur.seconds = sec;
    entry.tasks[task.id] = cur;
    timer.dirty = true;
  }
  if (timer.dirty && (urgent || now - timer.savedAt >= TIMER_SAVE_MS)) { timer.savedAt = now; timer.dirty = false; save(); }
  return sec >= total;
}

function tickTimer() {
  if (document.visibilityState !== 'visible' || !timer.run) return;
  if (timer.run.watch) { tickWatch(); return; }
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
  if (finished) finishTimer(kid, task, timer.run.day);
}

function finishTimer(kid, task, day = today()) {
  stopEars();
  stopTimer(false);
  sounds.day();
  confetti(80, 1800);
  ui.view = 'kid';
  ui.kidId = kid.id;
  render();
  if (task.verify === 'self') markDone(kid, task, 'self', undefined, day);
  else askParentNowOrLater(kid, task, undefined, day);
}

// Leaving the app: a task set to keep counting in other apps carries on (and
// remembers where it was, to show the parent the time spent away); any other
// timer pauses.
export function leaveTimer() {
  if (!timer.running) return;
  if (timer.run?.watch) {
    // the stopwatch keeps counting in other apps when the kid's piano chore is set to
    const kid = kidById(timer.run.kidId);
    if (!kid || !pianoTasks(kid).some((t) => t.background)) { stopTimer(); return; }
    syncWatch(true);
    timer.run.awayFrom = watchSplit(timer.run, Date.now()).fill;
    keepRun();
    return;
  }
  const found = runTask();
  if (!found?.task.background) { stopTimer(); return; }
  syncTimer(true);
  timer.run.awayFrom = entryFor(state, found.kid.id, timer.run.day)?.tasks?.[found.task.id]?.seconds || 0;
  keepRun();
}

export function returnToTimer() {
  if (!timer.running) return;
  grabWakeLock();
  tickTimer();
}

// The app was closed while a timer ran: pick it up again.
export function restoreTimer() {
  let run = null;
  try { run = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch { run = null; }
  if (!run?.kidId || !(run.taskId || run.watch) || !run.day || !run.since) return;
  timer.run = run;
  if (run.watch) {
    if (!kidById(run.kidId) || ui.view === 'setup') { timer.run = null; keepRun(); return; }
    if (run.day !== today()) { stopTimer(false); return; }
    ui.view = 'watch';
    ui.kidId = run.kidId;
    timer.running = true;
    grabWakeLock();
    timer.interval = setInterval(tickTimer, 1000);
    // the chore may have filled up while the app was closed
    setTimeout(() => { if (timer.run === run) tickWatch(); }, 300);
    return;
  }
  const found = runTask();
  if (!found || ui.view === 'setup') { timer.run = null; keepRun(); return; }
  if (run.day !== today()) { stopTimer(false); return; }
  if (syncTimer(true)) {
    // the time ran out while the app was closed
    setTimeout(() => finishTimer(found.kid, found.task, run.day), 300);
    return;
  }
  ui.view = 'timer';
  ui.kidId = run.kidId;
  ui.taskId = run.taskId;
  timer.running = true;
  grabWakeLock();
  timer.interval = setInterval(tickTimer, 1000);
}

// The buddy on the timer page says a cheer when tapped.
let lastCheer = -1;
let cheerTimeout = 0;
let cheerTaps = 0;
let lastEffort = '';

/** What a kid has really done lately, for praise that names the effort (see effortCheers). */
function effortFacts(kid) {
  const t = today();
  const piano = pianoStreakInfo(state, kid, t);
  const week = weekStart(t);
  let pianoWeek = 0;
  let minutesWeek = 0;
  for (let key = week; key <= t; key = addDays(key, 1)) {
    const entry = entryFor(state, kid.id, key);
    for (const task of tasksForDay(state, kid, key, t).filter(isPianoTask)) {
      const st = entry?.tasks?.[task.id];
      if (st?.status === 'done' || st?.status === 'pending') pianoWeek += 1;
      minutesWeek += Math.floor((st?.seconds || 0) / 60);
    }
  }
  const habit = [...habitInfo(state, kid, t).values()].find((h) => isPianoTask(h.task));
  return { name: kid.name, pianoStreak: piano.streak, pianoWeek, minutesWeek, pianoHabit: habit ? { done: habit.done, goal: habit.goal, mastered: Boolean(habit.mastered) } : null, month: monthDays(state, kid, t) };
}

/** One true sentence about the kid's effort, for the end-of-day celebration. */
export function effortNote(kid) {
  const t = today();
  const m = monthDays(state, kid, t);
  const near = [...habitInfo(state, kid, t).values()].filter((h) => !h.mastered).sort((a, b) => b.done / b.goal - a.done / a.goal)[0];
  if (near && near.done / near.goal >= 0.5) return `${near.task.name}: ${near.done} of ${near.goal} toward a habit star ⭐`;
  if (m.days >= 5) return `That's ${m.done} of ${m.days} days done this month.`;
  return '';
}

export function buddyCheer() {
  const kid = kidById(ui.kidId);
  const $b = document.querySelector('.timer-buddy');
  const $say = $b?.querySelector('.timer-bubble');
  if (!kid || !$say) return;
  if (!['head', 'silly'].includes($b.querySelector('canvas.live-buddy')?.dataset.zone)) live(liveKey(kid)).giggle();
  // every other tap names something the kid has really done (effort praise), the rest are plain cheers
  const facts = effortCheers(effortFacts(kid)).filter((line) => line !== lastEffort);
  if (facts.length && (cheerTaps += 1) % 2 === 0) {
    lastEffort = facts[Math.floor(Math.random() * facts.length)];
    $say.textContent = lastEffort;
  } else {
    lastCheer = pickCheer(lastCheer);
    $say.textContent = CHEERS[lastCheer](kid.name);
  }
  $b.classList.remove('hop');
  void $b.offsetWidth; // restart the hop
  $b.classList.add('talking', 'hop');
  $b.querySelector('.timer-sprite')?.addEventListener('animationend', () => $b.classList.remove('hop'), { once: true });
  sounds.tap();
  clearTimeout(cheerTimeout);
  cheerTimeout = setTimeout(() => $b.classList.remove('talking'), 4000);
}

export const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;


// ---------- the piano stopwatch (in the music house) ----------
// The practice timer counting up. While today's piano timer chores still have time to go,
// stopwatch time fills them in order, and finishes each one when it's full, just like the
// timer; after that (or with no piano chore today) it's extra practice, kept in the day's
// entry as pianoExtra. It listens and naps like the timer when a piano chore is set to
// listen, and keeps counting in other apps when one is set to. A run pauses itself after
// WATCH_MAX_RUN_MS, so a forgotten stopwatch doesn't count all day.

/** Today's piano timer chores for a kid. */
function pianoTasks(kid) {
  const t = today();
  return tasksForDay(state, kid, t, t).filter((x) => isPianoTask(x) && x.minutes > 0);
}

/**
 * Today's piano chores by where they stand: toFill (time still to go), unchecked (full, but
 * nobody has marked them done or sent them to a parent yet), and all of them.
 */
function pianoChores(kid) {
  const entry = entryFor(state, kid.id, today());
  const all = pianoTasks(kid);
  const st = (x) => entry?.tasks?.[x.id];
  const open = all.filter((x) => st(x)?.status !== 'done' && st(x)?.status !== 'pending');
  const full = (x) => (st(x)?.seconds || 0) >= x.minutes * 60;
  return { entry, all, toFill: open.filter((x) => !full(x)), unchecked: open.filter(full) };
}

/** What the stopwatch shows: today's piano time, the chores' goal, and the extra past it. */
export function pianoToday(kid) {
  const { entry, all, toFill, unchecked } = pianoChores(kid);
  const chore = all.reduce((n, x) => n + Math.min(x.minutes * 60, entry?.tasks?.[x.id]?.seconds || 0), 0);
  const goal = all.reduce((n, x) => n + x.minutes * 60, 0);
  const extra = entry?.pianoExtra || 0;
  // over: no chore has time left to fill (done, sent to a parent, or full)
  return { chore, goal, extra, total: chore + extra, over: all.length > 0 && !toFill.length, unchecked: unchecked.length };
}

/** Start (or carry on) the stopwatch. tapped: the kid pressed Start, so a full chore nobody checked yet is asked about again. */
export function startWatch(tapped = false) {
  const kid = kidById(ui.kidId);
  if (!kid) return;
  const { entry, toFill, unchecked } = pianoChores(kid);
  const chores = WATCH_FILLS_CHORE
    ? toFill.map((x) => ({ id: x.id, base: entry?.tasks?.[x.id]?.seconds || 0, total: x.minutes * 60 }))
    : [];
  timer.run = { kidId: kid.id, day: today(), since: Date.now(), watch: true, chores, done: [], extra: entry?.pianoExtra || 0, session: ui.watchSession || 0 };
  ui.watchNote = '';
  keepRun();
  resumeTimer();
  if (tapped && unchecked.length) finishWatchChores(kid, unchecked.map((x) => x.id));
}

/**
 * Bring the chores' seconds and the extra up to the clock. Returns the ids of chores that
 * have filled up and still need finishing.
 */
function syncWatch(force = false) {
  const run = timer.run;
  const kid = kidById(run?.kidId);
  if (!kid) return [];
  const now = Date.now();
  const split = watchSplit(run, now);
  ui.watchSession = split.session;
  const entry = entryFor(state, kid.id, run.day, true);
  let changed = false;
  let urgent = force;
  const filled = [];
  for (const c of run.chores || []) {
    const sec = split.fill[c.id];
    const had = entry.tasks[c.id];
    const cur = { status: 'inprogress', ...(had || {}) };
    let mine = !had;
    if (sec > (cur.seconds || 0)) { cur.seconds = sec; mine = true; }
    // time this chore filled while the stopwatch ran in another app, for the parent to see
    if (run.awayFrom) {
      const away = Math.max(0, sec - (run.awayFrom[c.id] ?? sec));
      if (away) { cur.away = (cur.away || 0) + away; mine = true; urgent = true; }
    }
    if (mine) { entry.tasks[c.id] = cur; changed = true; }
    if (!had) urgent = true;
    if (sec >= c.total && !run.done?.includes(c.id)) { filled.push(c.id); urgent = true; }
  }
  if (run.awayFrom) { run.awayFrom = null; keepRun(); }
  if (split.extra > (entry.pianoExtra || 0)) { entry.pianoExtra = split.extra; changed = true; }
  if (changed) timer.dirty = true;
  if (timer.dirty && (urgent || now - timer.savedAt >= TIMER_SAVE_MS)) { timer.savedAt = now; timer.dirty = false; save(); }
  return filled;
}

function tickWatch() {
  const run = timer.run;
  const kid = kidById(run.kidId);
  if (!kid) { stopTimer(); return; }
  const filled = syncWatch();
  if (run.day !== today()) {
    // midnight passed: yesterday's time stays with yesterday
    stopEars();
    stopTimer(false);
    if (ui.view === 'watch') { ui.view = 'kid'; render(); }
    return;
  }
  if (filled.length) finishWatchChores(kid, filled);
  if (watchSplit(run, Date.now()).capped) {
    // left running for hours: take a break until the kid says they're still playing
    stopEars();
    stopTimer(false);
    ui.watchNote = `The stopwatch paused after ${WATCH_MAX_RUN_MS / 3600_000} hours. Still playing? Tap Keep going!`;
    if (ui.view === 'watch') render();
    return;
  }
  updateWatchUi(kid);
}

/**
 * Piano chores the stopwatch filled up: each one is done (or a parent checks it), with a
 * cheer, and the stopwatch keeps going. Chores already done or sent to a parent meanwhile
 * (a parent on another phone) are left alone.
 */
function finishWatchChores(kid, ids) {
  const run = timer.run;
  if (run) { run.done = [...(run.done || []), ...ids]; keepRun(); }
  const day = run?.day || today();
  const entry = entryFor(state, kid.id, day);
  const tasks = ids.map((id) => taskById(kid, day, id))
    .filter((t) => t && !['done', 'pending'].includes(entry?.tasks?.[t.id]?.status));
  if (!tasks.length) return;
  sounds.day();
  confetti(80, 1800);
  const anchor = document.querySelector('.watch .ring');
  for (const t of tasks) if (t.verify === 'self') markDone(kid, t, 'self', anchor, day);
  // a parent checks one at a time; another one waiting is asked about on the next Start
  const ask = tasks.find((t) => t.verify !== 'self');
  if (ask) askParentNowOrLater(kid, ask, anchor, day);
}

function watchNumbers(kid) {
  const p = pianoToday(kid);
  const session = ui.watchSession || 0;
  return { ...p, session, ring: p.goal ? (p.over ? 1 : p.chore / p.goal) : (p.total % 600) / 600 };
}

function updateWatchUi(kid) {
  const n = watchNumbers(kid);
  const $t = document.getElementById('watch-today');
  if (!$t) return;
  $t.textContent = mmss(n.total);
  const $ring = document.getElementById('timer-ring');
  $ring?.style.setProperty('--p', n.ring);
  $ring?.classList.toggle('over', n.over);
  const $goal = document.getElementById('watch-goal');
  if ($goal) { $goal.textContent = watchGoalText(n); $goal.classList.toggle('done', n.over && !n.unchecked); }
  const $s = document.getElementById('watch-session');
  if ($s) $s.textContent = `This time: ${mmss(n.session)}`;
}

function watchGoalText(n) {
  if (!n.goal) return n.extra ? 'Extra practice!' : 'No piano chore today. Just for fun!';
  if (n.over && n.unchecked) return 'Goal reached! A parent needs to check it';
  if (n.over) return n.extra ? `Goal done ✓ +${mmss(n.extra)} extra` : 'Goal done ✓';
  return `Goal ${mmss(n.goal)}`;
}

export function viewWatch() {
  const kid = kidById(ui.kidId);
  if (!kid) { ui.view = 'kid'; return viewKid(); }
  const n = watchNumbers(kid);
  const tasks = pianoTasks(kid);
  const listens = tasks.some((t) => t.listen);
  const away = tasks.some((t) => t.background);
  const running = timer.running && timer.run?.watch;
  const naps = 'If the piano stops for a minute, it falls asleep and the stopwatch pauses until you play again.';
  const tip = [
    n.goal && !n.over ? 'Stopwatch time counts toward today\'s piano practice, and it keeps counting after you reach your goal.' : 'It counts up for as long as you play.',
    listens ? `Your buddy listens and dances to your beat. ${naps}` : '',
    away ? 'You can switch to another app, like Note Rush. The stopwatch keeps counting.' : 'The stopwatch pauses if you leave the app.',
  ].filter(Boolean).join(' ');
  const mood = listens && (ears.run || ears.asleep) ? ears.mood || 'waiting' : '';
  return `
    <div class="screen timer watch center" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="watch-back" aria-label="Back to the music house">←</button>
        <div class="kid-title"><b>⏱️ Piano stopwatch</b><small>${esc(kid.name)}</small></div>
      </header>
      <div class="timer-stage">
        <div class="ring ${n.over ? 'over' : ''}" id="timer-ring" style="--p:${n.ring}">
          <div class="ring-inner">
            <small>Piano today</small>
            <div class="timer-left watch-today" id="watch-today">${mmss(n.total)}</div>
            <small class="watch-goal ${n.over && !n.unchecked ? 'done' : ''}" id="watch-goal">${esc(watchGoalText(n))}</small>
          </div>
        </div>
        <button class="timer-buddy live" data-action="timer-buddy" aria-label="Tap ${esc(kid.name)}'s buddy for a cheer">
          <span class="timer-bubble" aria-live="polite"></span>
          <span class="timer-sprite" data-mood="${mood}">${liveHtml(liveKey(kid), dressed(kid), { background: false, feel: timerFeel(mood), idle: false, label: `${kid.name}'s buddy` })}</span>
        </button>
      </div>
      <p class="watch-session" id="watch-session">This time: ${mmss(n.session)}</p>
      ${ui.watchNote && !running ? `<p class="watch-note">${esc(ui.watchNote)}</p>` : ''}
      ${listens ? `<p class="timer-ears" id="ears"><b id="ears-text" aria-live="polite"${earsText() ? '' : ' hidden'}>${esc(earsText())}</b></p>` : ''}
      <button class="btn huge" data-action="${running ? 'timer-pause' : 'timer-start'}">${running ? 'Pause' : n.session ? 'Keep going' : 'Start'}</button>
      <p class="muted small">${tip}</p>
    </div>`;
}

// ---------- listening during practice ----------
// A timer task with "Listen to the piano" on listens while its timer runs and the
// timer page is on screen (listen.js; Google's recognizer decides what is piano).
// The buddy dances on the kid's beat (beat.js), or hops on notes when there is no
// beat. With no piano for 30 s it gets bored; after 60 s it falls asleep and the
// timer pauses, and playing again wakes it and the timer carries on. Without
// Google's recognizer (offline the first time) the buddy still dances, but it
// can't tell piano from talking, so it never falls asleep. Nothing is recorded.
export const ears = { run: null, beat: null, side: 1, token: 0, loading: false, error: '', google: false, from: 0, mood: '', asleep: false, asleepAt: 0, woke: -Infinity, lastUi: 0 };
const EARS_NAP = 10 * 60_000;   // asleep this long: stop listening and let the screen turn off

/** The timer page's task, when it listens. */
function earsTask() {
  if (ui.view === 'watch') {
    const kid = kidById(ui.kidId);
    const task = kid && pianoTasks(kid).find((t) => t.listen);
    return task ? { kid, task } : null;
  }
  if (ui.view !== 'timer') return null;
  const kid = kidById(ui.kidId);
  const task = kid && taskById(kid, today(), ui.taskId);
  return task?.listen && task.minutes > 0 ? { kid, task } : null;
}

export async function startEars() {
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

export function stopEars() {
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
export function wakeEars() {
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
      beat.note(ev.at, ev);
      if (!builtin && !dancing && piano && !ears.asleep) { buddyStep($b, 'hop'); earsBuddy()?.hop(); }
    } else if (ev.type === 'piano' && builtin && !dancing) { buddyStep($b, 'hop'); earsBuddy()?.hop(); }
  }
  const lead = danceLead();
  for (const b of beat.beats(now, listener.state.loud, lead)) {
    if (!piano || ears.asleep) continue;
    atBeat(b, lead, now, () => {
      if (ears.run?.listener !== listener) return;
      danceBeat(ears, document.querySelector('.timer .timer-buddy'), null, beat.period);
      earsBuddy()?.beat(beat.period);
    });
  }

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

/**
 * The line under the buddy. It stays empty while the buddy listens or dances: it
 * only speaks up when the buddy is bored or asleep, or can't hear at all.
 */
function earsText() {
  if (ears.error === 'blocked') return 'I can’t hear you: the microphone is blocked. Ask a parent.';
  if (ears.error === 'nomic') return 'I can’t hear you: no microphone was found.';
  if (ears.error) return 'I can’t hear you right now. Try Pause, then Keep going.';
  if (ears.asleep) return `Asleep, so the ${ui.view === 'watch' ? 'stopwatch' : 'timer'} is paused. Play to wake me up!`;
  if (ears.run && !ears.run.running) return 'Tap the screen so I can hear you!';
  if (ears.run && ears.mood === 'bored') return 'I haven’t heard the piano in a while…';
  return '';
}

function updateEarsUi(now = performance.now()) {
  const $text = document.getElementById('ears-text');
  if (!$text) return;
  const text = earsText();
  if ($text.textContent !== text) $text.textContent = text;
  $text.hidden = !text;
  const listener = ears.run?.listener;
  const $b = document.querySelector('.timer .timer-buddy');
  if (!(listener && pianoNow(listener, now) && ears.beat.following(now))) danceRest($b);
  const kid = earsTask()?.kid;
  const $sprite = $b?.querySelector('.timer-sprite');
  if (!$sprite || !kid) return;
  // the page keeps what it shows (a redraw may leave it be), so compare with the page
  const mood = ears.run || ears.asleep ? ears.mood || 'waiting' : '';
  if (mood !== $sprite.dataset.mood) $sprite.dataset.mood = mood;
  feel(liveKey(kid), timerFeel(mood, Boolean(listener && pianoNow(listener, now) && ears.beat.following(now))));
  // what it says (a cheer from a tap stays until it fades)
  const say = now - ears.woke < 2500 ? `I’m up! ${ui.view === 'watch' ? 'Stopwatch' : 'Timer'} back on.` : LISTEN_SAY[mood] || '';
  const $say = $b.querySelector('.timer-bubble');
  const mine = $say.dataset.ears || '';
  if (say && (say !== mine || !$b.classList.contains('talking'))) { $say.textContent = say; $b.classList.add('talking'); }
  else if (!say && mine && $say.textContent === mine) $b.classList.remove('talking');
  $say.dataset.ears = say;
}

export function viewTimer() {
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
          <span class="timer-sprite" data-mood="${mood}">${liveHtml(liveKey(kid), dressed(kid), { background: false, feel: timerFeel(mood), idle: false, label: `${kid.name}'s buddy` })}</span>
        </button>
      </div>
      ${task.listen ? `<p class="timer-ears" id="ears"><b id="ears-text" aria-live="polite"${earsText() ? '' : ' hidden'}>${esc(earsText())}</b></p>` : ''}
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
export const listenTest = { run: null, events: [], error: '', settings: null, lastUi: 0, woke: 0, loading: false, beat: null, side: 1 };
export const LISTEN_MODE_KEY = 'kidquest.listenMode';
const LISTEN_MODES = [['builtin', 'Built-in'], ['google', 'Google'], ['both', 'Both agree']];
function listenMode() {
  if (!ui.listenMode) {
    try { ui.listenMode = localStorage.getItem(LISTEN_MODE_KEY); } catch { /* private window */ }
    if (!LISTEN_MODES.some(([m]) => m === ui.listenMode)) ui.listenMode = 'google';
  }
  return ui.listenMode;
}
let lastListenMood = '';
export function setLastListenMood(mood) { lastListenMood = mood; }
const LISTEN_MOODS = { playing: 'excited', waiting: 'happy', bored: 'sad', asleep: 'sleepy' };
const LISTEN_LABELS = { playing: '🎹 Hearing piano', waiting: '👂 Listening…', bored: '😐 Bored (no piano for 30 s)', asleep: '😴 Asleep (the timer would pause)' };
const LISTEN_SAY = { bored: 'I’m bored… play something!', asleep: 'Zzz…' };
const LISTEN_BEAT = { none: 'Listening for a beat', free: 'No steady beat (that’s ok)' };

export function viewListen() {
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
      <div class="card">${danceLeadSlider()}</div>
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
    : `Mic ready, voice filters off${st.sampleRate ? ` · ${st.sampleRate} Hz` : ''}${st.notesFrom ? ` · notes from ${st.notesFrom}` : ''}${st.latency > 0 ? ` · Chrome says the mic is ${Math.round(st.latency * 1000)} ms behind` : ''}.`;
}

export async function startListenTest() {
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
    listenTest.settings = { ...listenTest.run.settings, sampleRate: listenTest.run.sampleRate, notesFrom: listenTest.run.notesFrom };
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

export function stopListenTest() {
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
// The buddy is seen dancing a little after the kid plays: the mic, the note finder
// (about 30 ms) and the screen each take their time. The beat follower foretells the beats,
// so each dance move starts this many ms early and lands on the beat the kid played. The
// delay differs from tablet to tablet; a parent can change it on the listening test page.
export const DANCE_LEAD_KEY = 'kidquest.danceLead';
export const DANCE_LEAD = { normal: 120, min: 0, max: 400, step: 10 };
function danceLead() {
  if (ui.danceLead == null) {
    let v = null;
    try { v = localStorage.getItem(DANCE_LEAD_KEY); } catch { /* private window */ }
    const n = v == null ? NaN : Number(v);
    ui.danceLead = Number.isFinite(n) ? Math.min(DANCE_LEAD.max, Math.max(DANCE_LEAD.min, n)) : DANCE_LEAD.normal;
  }
  return ui.danceLead;
}

/** The "dance earlier" slider on the listening test page. */
function danceLeadSlider() {
  const v = danceLead();
  return `
    <label class="dance-lead">
      <span class="row"><b class="grow">Dance earlier</b><b data-dance-lead-out>${v} ms</b></span>
      <input type="range" min="${DANCE_LEAD.min}" max="${DANCE_LEAD.max}" step="${DANCE_LEAD.step}" value="${v}" data-dance-lead aria-label="Dance earlier, in milliseconds">
    </label>
    <small class="muted">The tablet hears, works out and shows each beat a little late, so the dancing buddy starts each move this much early. Play a steady song: if the buddy bounces just after your notes, slide right; if just before, slide left. It counts for the piano timer on this tablet too (it starts at ${DANCE_LEAD.normal} ms).</small>`;
}

/** Runs fn when the beat at b (ms, as the follower heard it) should show: lead ms early. */
function atBeat(b, lead, now, fn) {
  const wait = b - lead - now;
  if (wait <= 4) fn();
  else setTimeout(fn, wait);
}

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
      beat?.note(ev.at, ev);
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
  const lead = danceLead();
  for (const b of beat?.beats(now, listener.state.loud, lead) || []) {
    if (!pianoNow(listener, now)) continue;
    atBeat(b, lead, now, () => {
      if (listenTest.run?.listener !== listener) return;
      danceBeat(listenTest, document.querySelector('.listen-buddy'), document.getElementById('ls-metro'), beat.period);
    });
  }
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

