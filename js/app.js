import {
  DAY_NAMES, defaultTasks, dateKey, addDays, parseKey, newId, entryFor,
  tasksForDay, snapshotToday, dayStatus, weeklyRewardInfo, storeOpen, streakInfo, totalXp, totalCoins, levelFor, taskXp, taskCoins,
  defaultReward, parseReward, MAX_REWARD,
  pendingApprovals, fallbackHash, pianoStreakInfo,
  isExercise, taskGems, totalGems, exerciseStreakInfo, DEFAULT_GEMS, EXERCISE_DAYS,
  defaultAllowance, repairAllowanceStart, allowanceFor, parseAllowance, taskPay, taskSize, SIZES, weekEarnings, recentBonuses,
  DEFAULT_ALLOWANCE, DEFAULT_BONUS_LIMIT, questTasks,
  weekParity, isEveryOtherWeek, onWeek, weekStart,
  withMemo, monthDays, habitInfo, MASTERED_PAY, CUES, cueFor, planOrder, planSentence,
  todaySummary, familyDay, FAMILY_GOAL, milestoneFor, milestoneFresh,
} from './logic.js';
import { sounds, confetti, setSound } from './fx.js';
import { buddySvg, buddyLine, MOVE_ART, catchFor, ballSvg } from './avatar.js';
import { liveHtml, live, liveStart, partyAll } from './live.js';
import { paintQuestMaps, mapTheme } from './maparts.js';
import { mapParty } from './maplife.js';
import { villageHtml, mountVillages, cameOut, cameOutOfMusic } from './village.js';
import { houseHtml, mountHouses, cameIn } from './house.js';
import { houseChores, shelfLevel, placeOf, setPlace, setInside, HOUSE_CHORES, houseChoreById, setHouseRole, houseTask } from './houserules.js';
import { musicHouseHtml, mountMusicHouses, cameInMusic } from './musichouse.js';
import { musicTier, daysToMusicHouse, studioOpen, tierInfo } from './musicrules.js';
import { spotById, homeLayout, isPlaced, placeFurniture } from './furniture.js';
import { applyGrants } from './grants.js';
import { furnitureThumb } from './houseart.js';
import { leaderboard, weekOf } from './leaderboard.js';
import { bookPages, bookCount, fishSpecies, tankFish, makeTank, NICK_MAX } from './fishbook.js';
import { fishPic } from './fishart.js';
import { startMusic, stopMusic, playShowAudio } from './music.js';
import { viewSongbook, mountSongbook, songbookActions, openSongbook } from './songbook.js';
import { viewStudio, mountStudio, studioActions, openStudio } from './studio.js';
import {
  SPECIES, SLOTS, ITEMS, itemById, isUnlocked, needLabel, needGap, pianoDaysNeeded, LEGACY_LEVEL, wandPower, defaultBuddy, restingMood, isWorn, ownedFor, addOwned, fitsSpecies, moveWornToBuddy, switchSpecies,
  SPORTS, MOVES, unlockedMoves, pickMove, moveWeeks, bestGear,
} from './items.js';
import { pickVisitors, visitorLines, milestoneBrag, milestoneCheer, MAX_VISITORS } from './visits.js';
import { GAME_NAMES } from './play.js';
import { openPlay } from './playground.js';
import { SPOTS as FISH_SPOTS } from './fishing.js';
import { chestTier, chestPrize, treasureFound, mapsNeedingPieces, chestReady, prizeText, TROPHIES, PIECES_PER_MAP, tierById, LATE_DAYS } from './treasure.js';
import { chestSvg, trophySvg, mapPiecesSvg, secretSvg, secretSize, SECRETS } from './treasure-art.js';
import { playShow, showPlaying } from './mapshow.js';
import { createStore, migrate, localBackend, splitState, stableJson, DEVICE_SETTINGS } from './store.js';
import { state, setState, provide } from './ctx.js';
import {
  startTimer, stopTimer, leaveTimer, returnToTimer, restoreTimer, timerOnScreen, mmss, buddyCheer,
  ears, startEars, stopEars, wakeEars, viewTimer, viewWatch,
  listenTest, viewListen, startListenTest, stopListenTest, setLastListenMood, LISTEN_MODE_KEY, DANCE_LEAD, DANCE_LEAD_KEY,
} from './timer-ui.js';
import {
  pendingRemote, setPendingRemote, loadCloud, onCloudStatus, startCloud, applyRemote,
  familyCard, familyCreate, familyJoin, familyJoinGo, familyInvite, showCode, familyLeave,
} from './sync-ui.js';
import { showUnlocks, celebrateIfDue } from './celebrate.js';
import { moveIds, gamesLeftFor, playableFor, visitPlan, gamesWith, pickGame, playWith } from './play-ui.js';

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
    const { changed, removed } = store.save(state);
    // A family update held back while a dialog was open is now older than this
    // device's own data. Applying it when the dialog closes would undo what was
    // just saved (a kid buys something, then right away buys something else on
    // top of the old data, and the first purchase is lost). The write we just
    // sent comes back as a fresh update that holds both, so drop the old one.
    // Device settings never go to the family, so they send nothing back.
    if ([...changed, ...removed].some((p) => p !== 'device')) setPendingRemote(null);
  } catch {
    toast('Could not save. Is storage full?');
  }
}

setState(store.load());
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
// The kid as they are now. A family update replaces state (and every kid
// object), so anything that runs later (a timeout, a game callback) must look
// the kid up again, or its changes land on an old copy and never save.
const currentKid = (kid) => kidById(kid.id) || kid;

function progressFor(kid) {
  const t = today();
  const info = streakInfo(state, kid, t);
  const xp = totalXp(state, kid, t);
  const lv = levelFor(xp);
  const piano = pianoStreakInfo(state, kid, t);
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
  return exerciseStreakInfo(state, kid, today());
}

/** Everything a buddy needs to do its moves: its look, the kid's gear, and how far the exercise streak got. */
const mover = (kid) => ({ buddy: dressed(kid), owned: kid.owned || [], exBest: Math.max(kid.exBest || 0, exerciseInfo(kid).best) });

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
 * A kid's buddy as it is drawn right now: with the magic wand's glow (buddy.wand)
 * from how much of today's chores are done. The glow is never saved.
 */
const dressed = (kid, buddy = kid.buddy) => ({ ...buddy, wand: wandPower(todaySummary(state, kid, today())) });
/** A visiting buddy, with its wand glowing from that kid's day (their shared summary of today). */
const dressedVisitor = (v, buddy = v.buddy) => ({ ...buddy, wand: wandPower(v.today?.day === today() ? v.today : null) });

/**
 * A kid's buddy. size: css class for sizing. opts.live: drawn live by rig.js
 * (it moves, feels and reacts to taps); otherwise the still picture from avatar.js.
 * opts.feel: feelings to use instead of feelFor; opts.idle: gets bored when left alone.
 */
function buddyHtml(kid, mood, size = 'lg', opts = {}) {
  if (opts.live) {
    const html = liveHtml(liveKey(kid), dressed(kid), { background: opts.background !== false, feel: opts.feel || feelFor(kid, mood), idle: opts.idle, label: `${kid.name}'s buddy` });
    return `<div class="buddy buddy-${size} live">${html}</div>`;
  }
  return `<div class="buddy buddy-${size} mood-${mood}">${buddySvg(dressed(kid), mood, opts)}</div>`;
}
const buddyChip = (kid) => `<span class="avatar xs buddy-chip">${buddySvg(dressed(kid), 'happy', { background: false })}</span>`;
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
  document.querySelectorAll('.toast').forEach((t) => t.remove()); // one at a time
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
  if (pendingRemote && $modal.hidden) { const next = pendingRemote; setPendingRemote(null); applyRemote(next); }
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

// ---------- celebrations (see celebrate.js) ----------

// ---------- the kid's plan: order and cues ----------

function planModal(kid) {
  const d = ui.planDraft;
  const block = (period, title) => {
    const tasks = planOrder({ plan: d }, questTasks(kid.tasks).filter((x) => x.period === period));
    if (!tasks.length) return '';
    return `<h3>${title}</h3>${tasks.map((task, i) => {
      const cue = d.cues[task.id] || '';
      return `<div class="plan-row">
          <div class="plan-top"><span class="plan-name">${esc(task.icon)} ${esc(task.name)}</span>
            <span class="plan-move"><button class="btn ghost round" data-action="plan-move" data-id="${task.id}" data-dir="-1" ${i ? '' : 'disabled'} aria-label="Earlier">▲</button><button class="btn ghost round" data-action="plan-move" data-id="${task.id}" data-dir="1" ${i < tasks.length - 1 ? '' : 'disabled'} aria-label="Later">▼</button></span></div>
          <select data-plancue="${task.id}" aria-label="When for ${esc(task.name)}">
            <option value="">Pick a moment…</option>
            ${CUES[period].map((c) => `<option ${c === cue ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
          ${cue ? `<small class="plan-say">${esc(planSentence(cue, task))}</small>` : ''}
        </div>`;
    }).join('')}`;
  };
  const html = `
    <div class="plan">
      <h1>📝 ${esc(kid.name)}'s plan</h1>
      <p class="muted">Put your tasks in the order you'll do them, and pick the moment that reminds you. Doing it at the same moment every day is how it becomes a habit.</p>
      ${block('morning', '🌅 Morning')}
      ${block('afternoon', '☀️ After school')}
      <div class="row end">
        <button class="btn ghost" data-action="modal-close">Cancel</button>
        <button class="btn" data-action="plan-save" data-kid="${kid.id}">Save my plan</button>
      </div>
    </div>`;
  // already open: change it in place, so it doesn't pop in again on every pick
  const open = !$modal.hidden && $modal.querySelector('.modal-card > .plan');
  if (open) open.outerHTML = html;
  else openModal(html);
}

function openPlan(kid) {
  closeModal();
  ui.planKid = kid.id;
  ui.planDraft = { order: planOrder(kid, questTasks(kid.tasks)).map((x) => x.id), cues: { ...(kid.plan?.cues || {}) } };
  planModal(kid);
}

// ---------- the treasure chest (see treasure.js) ----------

/** A day's chest: its tier, whether it can be opened now, and what was in it once opened. */
function chestFor(kid, key) {
  const t = today();
  const s = dayStatus(state, kid, key, t);
  const opened = entryFor(state, kid.id, key)?.chest || null;
  const ready = chestReady(key, t, { complete: s.complete, total: s.total, excused: s.excused, opened: Boolean(opened) });
  // the streak counting this day: until the day is done, as if it were
  const streak = streakInfo(state, kid, key).streak + (s.complete ? 0 : 1);
  return { key, s, opened, ready, tier: opened ? tierById(opened.tier) : chestTier(streak) };
}

/** An earlier day's chest that is still waiting (a parent approved late), or null. */
function lateChest(kid) {
  for (let i = 1; i <= LATE_DAYS; i += 1) {
    const c = chestFor(kid, addDays(today(), -i));
    if (c.ready) return c;
  }
  return null;
}

/** The Places backgrounds (maps) this kid has unlocked. */
const unlockedMaps = (kid) => {
  const prog = progressFor(kid);
  return ITEMS.filter((i) => i.slot === 'background' && isUnlocked(i, prog)).map((i) => i.id);
};
const mapName = (id) => mapTheme(id).name;
const mapGround = (id) => mapTheme(id).ground[0];

function openChest(kid, key) {
  const c = chestFor(kid, key);
  if (!c.ready) return;
  const found = treasureFound(state.log, kid.id);
  const maps = mapsNeedingPieces(unlockedMaps(kid), kidTheme(kid), found);
  // extra games are only any use with visitors to play with (they keep until tomorrow)
  const games = key === today() && pickVisitors(kid.id, familyBuddies(), today()).length > 0;
  const prize = chestPrize({ seed: `${kid.id}|${key}`, tier: c.tier, found, maps, games });
  entryFor(state, kid.id, key, true).chest = { ...prize, at: Date.now() };
  save();
  const after = treasureFound(state.log, kid.id);
  const words = prizeText(prize, mapName);
  let art = '';
  let extra = '';
  if (prize.kind === 'coins') art = '<div class="prize-emoji">🪙</div>';
  else if (prize.kind === 'gems') art = '<div class="prize-emoji">💎</div>';
  else if (prize.kind === 'games') art = '<div class="prize-emoji">⚽</div>';
  else if (prize.kind === 'trophy') art = trophySvg(prize.trophy, { scale: 6 });
  else {
    const n = after.pieces[prize.map] || 0;
    art = mapPiecesSvg(n, PIECES_PER_MAP, { scale: 7, ground: mapGround(prize.map) });
    extra = n >= PIECES_PER_MAP
      ? `<p class="prize-big">You finished the ${esc(mapName(prize.map))} treasure map! Something secret is waiting on that map now. 👀</p>`
      : `<p class="muted">${n} of ${PIECES_PER_MAP} pieces</p>`;
  }
  sounds.tap();
  openModal(`
    <div class="celebrate chest-card chest-${c.tier.id}">
      <div class="chest-shake">${chestSvg(c.tier.id, false, 7)}</div>
      <div class="chest-reveal">
        <div class="chest-behind">${chestSvg(c.tier.id, true, 5)}</div>
        <div class="prize-art">${art}</div>
        <h1>${esc(words.title)}</h1>
        <p>${esc(words.text)}</p>
        ${extra}
        <button class="btn huge" data-action="modal-close">Awesome!</button>
      </div>
    </div>`, () => render());
  setTimeout(() => { sounds.day(); confetti(prize.kind === 'piece' || prize.kind === 'trophy' ? 160 : 90, 2200); }, 1000);
}

/** The trophy shelf and the treasure maps. */
function openTrophies(kid) {
  const found = treasureFound(state.log, kid.id);
  const maps = unlockedMaps(kid);
  const shelf = TROPHIES.map((t) => {
    const has = found.trophies.has(t.id);
    return `<div class="trophy ${has ? '' : 'missing'}">${trophySvg(t.id, { scale: 3, locked: !has })}<small>${has ? esc(t.name) : '?'}</small></div>`;
  }).join('');
  const mapShelf = [...found.maps].map((m) => `<div class="trophy">${trophySvg(`map-${m}`, { scale: 3, ground: mapGround(m) })}<small>${esc(mapName(m))} map</small></div>`).join('');
  const mapRows = maps.map((m) => {
    const n = found.pieces[m] || 0;
    return `<div class="treasure-map-row">${mapPiecesSvg(n, PIECES_PER_MAP, { scale: 3, ground: mapGround(m) })}<div><b>${esc(mapName(m))}</b><small>${n >= PIECES_PER_MAP ? 'Finished! Find the secret on this map.' : `${n} of ${PIECES_PER_MAP} pieces`}</small></div></div>`;
  }).join('');
  openModal(`
    <div class="trophy-room">
      <h2>🏆 ${esc(kid.name)}'s trophies</h2>
      <p class="muted small">Trophies come from treasure chests. ${found.trophies.size} of ${TROPHIES.length} found.</p>
      <div class="trophy-shelf">${shelf}${mapShelf}</div>
      <h3>🗺️ Treasure maps</h3>
      <p class="muted small">Silver and gold chests sometimes hold a piece of a treasure map. Finish one to find a secret on that map.</p>
      <div class="treasure-maps">${mapRows}</div>
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
}

// ---------- task actions ----------

function setTask(kid, key, task, value) {
  const entry = entryFor(state, kid.id, key, true);
  if (value === null) delete entry.tasks[task.id];
  else entry.tasks[task.id] = { ...(entry.tasks[task.id] || {}), ...value };
  save();
}

// day: the day the chore belongs to (a practice timer's day, when a parent signs off after midnight)
function markDone(kid, task, by, anchor, day = today()) {
  setTask(kid, day, task, { status: 'done', at: Date.now(), by });
  sounds.task();
  const { xp, coins, gems } = taskPay(state, kid, day, task, today());
  floatText([gems && `+${gems} 💎`, xp && `+${xp} XP`, coins && `+${coins} 🪙`].filter(Boolean).join(' · ') || 'Done!', anchor);
  ui.cheerUntil = Date.now() + 2600;
  ui.cheerKid = kid.id;
  live(liveKey(kid)).cheer();
  render();
  setTimeout(() => celebrateIfDue(currentKid(kid)), 700);
  setTimeout(() => { if (ui.view === 'kid' && Date.now() >= ui.cheerUntil) render(); }, 2700);
}

function askParentNowOrLater(kid, task, anchor, day = today()) {
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
    pinPad({ title: 'Parent sign-off', subtitle: `${kid.name}: ${task.name}`, onSuccess: () => markDone(kid, task, 'parent', anchor, day) });
  };
  modalActions['pin-later'] = () => {
    closeModal();
    setTask(kid, day, task, { status: 'pending', at: Date.now() });
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

// The practice timer and piano listening live in timer-ui.js.
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
        <div class="streak ${info.streak ? '' : 'cold'}">🔥 ${info.streak} <small class="best" title="Best streak">🏆 ${info.best}</small></div>
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
  const cue = cueFor(kid, task);
  if (cue && state_ === 'todo') sub = `${cue} · ${sub}`;
  const star = habitInfo(state, kid, today()).get(task.id)?.mastered ? ' ⭐' : '';
  return `
    <button class="tile ${state_}" data-action="task" data-id="${task.id}">
      <span class="tile-icon">${esc(task.icon)}</span>
      <span class="tile-text"><b>${esc(task.name)}${star}</b><small>${esc(sub)}</small></span>
      <span class="tile-check">${st === 'done' ? '✓' : st === 'pending' ? '⏳' : ''}</span>
    </button>`;
}

// Board-game path: one stop per task, winding down the screen, ending at a treasure chest.
const MAP_ROW = 124;
const VILLAGE = 225; // extra room at the top of the map when buddies are visiting

// Everyone in the family who has a buddy: this device's kids plus, on a kid's
// device, the others from the cloud.
function familyBuddies() {
  const all = new Map((family.buddies || []).map((b) => [b.id, b]));
  for (const k of state.kids) all.set(k.id, { id: k.id, name: k.name, color: k.color, buddy: k.buddy, owned: k.owned || [], exBest: mover(k).exBest, today: todaySummary(state, k, today()), milestone: k.milestone || null, playBest: k.playBest || {}, gameBests: k.gameBests || null });
  return [...all.values()];
}

/**
 * Keep each kid's summary of today (kid.today) up to date, so the family's
 * other devices can tell how the whole family is doing (see familyDay).
 * Only needed with family sync: on one device every kid is here already.
 */
function shareToday() {
  let changed = false;
  for (const k of state.kids) {
    // the best exercise run, for this buddy's moves when it visits other kids' devices
    const exBest = exerciseInfo(k).best;
    if ((k.exBest || 0) < exBest) { k.exBest = exBest; changed = true; }
    // the kid's newest milestone, for visiting buddies to mention on other maps
    const m = milestoneFor(state, k, today());
    if (stableJson(m) !== stableJson(k.milestone)) { k.milestone = m; changed = true; }
    if (!cloudCfg) continue;
    const now = todaySummary(state, k, today());
    if (stableJson(now) !== stableJson(k.today)) { k.today = now; changed = true; }
  }
  return changed;
}

// ---------- cheering each other's milestones ----------
// A visitor who just reached a milestone mentions it, with a Cheer button.
// A cheer is saved on the other kid (kid.cheers[milestoneId][fromKidId]), and
// the next time that kid opens their map, the friend's buddy is visiting and
// cheers back, with a little dance.

/** Cheers this kid got in the last day or so: Map fromKidId -> { mid, what }. */
function cheersFor(kid) {
  const out = new Map();
  const since = Date.now() - 36 * 3600 * 1000;
  for (const [mid, byKid] of Object.entries(kid.cheers || {})) {
    for (const [from, c] of Object.entries(byKid || {})) if ((c?.at || 0) > since && c.what) out.set(from, { mid, what: c.what, at: c.at });
  }
  return out;
}

/** Today's visitors: anyone who sent a cheer comes first, then the usual random pick. */
function todaysVisitors(kid) {
  const all = familyBuddies();
  const cheering = [...cheersFor(kid).keys()].map((id) => all.find((b) => b.id === id && b.buddy)).filter(Boolean);
  const picked = pickVisitors(kid.id, all, today());
  const seen = new Set();
  return [...cheering, ...picked].filter((v) => !seen.has(v.id) && seen.add(v.id)).slice(0, MAX_VISITORS);
}

const cheerKey = (v, m) => `${v.id}|${m.id}`;

function sendCheer(kid, v) {
  const m = v?.milestone;
  if (!kid || !m) return;
  const cheer = { name: kid.name, at: Date.now(), what: m };
  kid.cheersSent = Object.fromEntries([...Object.entries(kid.cheersSent || {}), [cheerKey(v, m), today()]].slice(-30));
  const local = kidById(v.id);
  if (local) {
    local.cheers = { ...(local.cheers || {}), [m.id]: { ...(local.cheers?.[m.id] || {}), [kid.id]: cheer } };
  } else if (cloudCfg) {
    loadCloud().then((mod) => mod.sendCheer(cloudCfg.familyId, v.id, m.id, kid.id, cheer)).catch((err) => console.error('Kid Quest cheer', err));
  }
  save();
  sounds.day();
  confetti(80, 1600);
  live(liveKey(kid)).cheer();
  live(`visit:${v.id}`).giggle();
  toast(`Cheer sent! 🎉 Your buddy will go cheer for ${v.name}.`);
  render();
}

/** The first time a friend's buddy comes to cheer, it dances and the kid hears about it. */
function greetCheers() {
  if (ui.view !== 'kid' || state.settings.questView === 'list') return;
  const kid = kidById(ui.kidId);
  if (!kid) return;
  const fresh = [...cheersFor(kid)].filter(([from, c]) => !(kid.cheersSeen || []).includes(`${from}|${c.mid}`));
  if (!fresh.length) return;
  kid.cheersSeen = [...(kid.cheersSeen || []), ...fresh.map(([from, c]) => `${from}|${c.mid}`)].slice(-30);
  save();
  partyAll(fresh.map(([from]) => `visit:${from}`), 4000);
  const names = fresh.map(([from, c]) => familyBuddies().find((b) => b.id === from)?.name || kid.cheers[c.mid][from].name);
  toast(`🎉 ${names.join(' and ')} came to cheer for you!`);
}

/** How the whole family is doing today, and whether the map should party. */
const familyToday = () => familyDay(familyBuddies(), today());

/** "Family: 8 of 10 chores done today" while there is more than one kid. */
function familyBanner() {
  const all = familyBuddies();
  if (all.length < 2) return '';
  const f = familyDay(all, today());
  const goal = Math.round(FAMILY_GOAL * 100);
  const text = f.happy
    ? `🎉 Family party! Everyone's done ${Math.round(f.share * 100)}% of today's chores`
    : f.unknown
      ? `👨‍👩‍👧‍👦 Family: ${f.done} chores done so far · when everyone gets to ${goal}%, the whole map celebrates`
      : `👨‍👩‍👧‍👦 Family: ${f.done} of ${f.total} chores done · at ${goal}% the whole map celebrates`;
  return `<div class="family-banner ${f.happy ? 'happy' : ''}" data-action="family-party">${esc(text)}${f.happy ? '' : `<span class="bar"><span style="width:${Math.min(100, Math.round((f.share / FAMILY_GOAL) * 100))}%"></span></span>`}</div>`;
}

// The family party: every buddy on the map gets a silly happy face and dances,
// and the map's critters bounce along, for a few seconds each time the map opens.
const PARTY_MS = 5000;
let partyDue = false;
let partyDay = null; // the day the family party already started by itself on this screen
function maybeParty() {
  if (ui.view !== 'kid' || state.settings.questView === 'list') return;
  const happy = familyToday().happy;
  // when the family crosses the goal while the map is open, celebrate right then too
  const justNow = happy && partyDay !== today();
  if (!(happy && (partyDue || justNow))) { partyDue = false; return; }
  partyDue = false;
  partyDay = today();
  startParty();
}
function startParty() {
  const keys = [...$app.querySelectorAll('.quest-map canvas.live-buddy, .village canvas.live-buddy')].map((c) => c.dataset.live);
  partyAll(keys, PARTY_MS);
  mapParty(PARTY_MS);
  $app.querySelectorAll('.quest-map, .village').forEach((el) => el.classList.add('party'));
  setTimeout(() => $app.querySelectorAll('.quest-map, .village').forEach((el) => el.classList.remove('party')), PARTY_MS);
}

const visitorsArrived = new Set();

// How a visiting buddy feels on the map: content, focused while fishing, and
// bouncing to play once the host's quest is done.
function visitFeel(area, complete) {
  if (area?.kind === 'pond') return { valence: 0.6, arousal: 0.45, focus: 0.3 };
  if (complete) return { valence: 0.9, arousal: 0.85 };
  if (area) return { valence: 0.8, arousal: 0.65 };
  return { valence: 0.6, arousal: 0.55 };
}

/** Today's visitors, what each one says, and who has news (shared by the map and the village). */
function visitorInfo(kid, s) {
  const visitors = todaysVisitors(kid);
  if (!visitors.length) return { visitors, lines: [], news: {} };
  const lines = visitorLines(visitors, { name: kid.name, streak: streakInfo(state, kid, today()).streak, complete: s.complete }, today());
  // once the quest is done, every visitor wants to play (see playWith)
  if (s.complete) {
    const left = gamesLeftFor(kid);
    const invite = { soccer: 'Keepy-uppy? Tap me!', hockey: 'Hockey? Tap me!', football: 'Wanna throw the football? Tap me!', fishing: 'Wanna go fishing? Tap me!', tag: 'Wanna play tag? Tap me!' };
    const plan = visitPlan(kid, visitors);
    visitors.forEach((v, i) => { lines[i] = left > 0 ? invite[gamesWith(kid, v, plan)[0]] : "That's all our games today! See you tomorrow"; });
  } else if (playableFor(kid, false) > 0) {
    // chest games saved from yesterday can be played before today's chores
    const n = playableFor(kid, false);
    visitors.forEach((v, i) => { lines[i] = `${n} treasure game${n === 1 ? '' : 's'} left from yesterday! Tap me!`; });
  }
  // milestones: a friend who came to cheer says so; a visitor with news mentions it, with a Cheer button
  const cheers = cheersFor(kid);
  const news = {};
  visitors.forEach((v, i) => {
    const c = cheers.get(v.id);
    if (c) { lines[i] = milestoneCheer(c.what, kid.name); news[v.id] = 'cheering'; return; }
    const m = v.milestone;
    if (!milestoneFresh(m, today())) return;
    if (kid.cheersSent?.[cheerKey(v, m)]) { lines[i] = 'Thanks for the cheer! 😊'; return; }
    lines[i] = milestoneBrag(m);
    news[v.id] = 'news';
  });
  return { visitors, lines, news };
}

function visitorsHtml(kid, s) {
  const { visitors, lines, news } = visitorInfo(kid, s);
  if (!visitors.length) return { html: '', room: 0, areas: '' };
  // stand in front of the village houses (see paintOne in maparts.js): an outer and an inner spot each side
  const wide = ($app.clientWidth || window.innerWidth) > 600;
  const X = wide ? { left: [20, 33], right: [80, 67] } : { left: [25, 40], right: [75, 60] };
  // players stand at the two ends of their field; placePlayers in maparts.js puts them exactly on it
  const GX = wide ? { left: [16, 42], right: [84, 58] } : { left: [16, 41], right: [84, 59] };
  const gearOf = (v) => bestGear(v.owned);
  const plan = visitPlan(kid, visitors);
  const areaOf = (id) => plan.areas.find((a) => a.members.includes(id));
  const version = (tier) => ['regular', 'good', 'super'][tier - 1];
  const html = visitors.map((v, i) => {
    const spot = plan.spots[v.id];
    const area = areaOf(v.id);
    const x = (area && area.kind !== 'pond' ? GX : X)[spot.side][spot.slot];
    const solo = area && area.kind !== 'pond' && area.members.length === 1;
    const gear = gearOf(v);
    let look = dressedVisitor(v);
    let cls = '';
    let extra = '';
    let data = '';
    if (area?.kind === 'pond') {
      // fishing in the village pond, facing away from the road
      look = dressedVisitor(v, { ...v.buddy, outfit: { ...v.buddy.outfit, music: undefined, sport: `sport-rod-${version(gear.rod)}` } });
      cls = `fishing face-${spot.side}`;
      data = `data-rod="${gear.rod}"`;
      extra = '<div class="fish-line" aria-hidden="true"><span class="bobber"></span></div><div class="fish-catch" aria-hidden="true"></div>';
    } else if (area) {
      // playing a game: the one nearer the left edge is player a. Sticks are held, balls are shared.
      // on their own, they practice from the outer end (a borrowed stick if they have none)
      const a = x === Math.min(...area.members.map((id) => GX[plan.spots[id].side][plan.spots[id].slot]));
      const outfit = { ...v.buddy.outfit, music: undefined, sport: area.kind === 'hockey' ? `sport-hockey-${version(gear.hockey || 1)}` : undefined };
      look = dressedVisitor(v, { ...v.buddy, outfit });
      const facesIn = solo ? spot.side === 'right' : a && area.kind === 'hockey';
      cls = `playing play-${area.kind} ${solo ? 'solo' : `player-${a ? 'a' : 'b'}`} ${facesIn ? 'face-left' : ''}`;
    }
    return `
      <div class="map-visitor ${i === 0 || news[v.id] ? 'talking' : ''} ${news[v.id] || ''} ${spot.slot ? 'inner' : ''} ${x < 20 ? 'edge-left' : x > 80 ? 'edge-right' : ''} ${cls}" data-action="visitor" data-id="${esc(v.id)}" ${data} ${area && area.kind !== 'pond' ? `data-play-side="${spot.side}" data-slot="${solo ? 0 : spot.slot}"` : ''} style="left:${x}%;--kid:${esc(v.color || '#4dabf7')}">
        <div class="visitor-buddy">${liveHtml(`visit:${v.id}`, look, { background: false, feel: visitFeel(area, s.complete), label: `${v.name}'s buddy` })}</div>
        ${extra}
        <div class="visitor-name">${esc(v.name)}</div>
        <div class="visitor-bubble">${esc(lines[i])}${news[v.id] === 'news' ? `<button class="cheer-btn" data-action="send-cheer" data-id="${esc(v.id)}">🎉 Cheer</button>` : ''}</div>
      </div>`;
  }).join('');
  // the ball (or puck) goes back and forth between the two players
  // on their own, a player juggles, shoots at the far goal or throws it up and catches it.
  // The kid's own field can be tapped to play right away.
  const playable = playableFor(kid, s.complete);
  const games = plan.areas.filter((a) => a.kind !== 'pond').map((a) => {
    const xs = [...GX[a.side]].sort((p, q) => p - q);
    const tiers = a.members.map((id) => gearOf(visitors.find((v) => v.id === id))[a.kind] || 1);
    if (a.host) tiers.push(bestGear(kid.owned || [])[a.kind] || 1);
    const solo = a.members.length === 1 ? `solo from-${a.side}` : '';
    const tap = a.host && playable > 0 ? `data-action="visitor" data-id="${esc(a.members[0])}" data-pick="${a.kind}" role="button" aria-label="Play ${GAME_NAMES[a.kind]}"` : 'aria-hidden="true"';
    return `<div class="map-game game-${a.kind} ${solo} ${a.host ? 'host-field' : ''}" data-side="${a.side}" style="left:${xs[0]}%;width:${xs[1] - xs[0]}%" ${tap}><span class="game-ball">${ballSvg(a.kind, Math.max(...tiers))}</span></div>`;
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
/** Room at the bottom of the map for the secret landmark. */
const SECRET_ROOM = 280;
/** A show can play again a minute after the last one. */
const SHOW_AGAIN_MS = 60000;

function questMap(kid, s, entry, mood) {
  const rows = [];
  const add = (period, label) => {
    const tasks = planOrder(kid, s.tasks.filter((x) => x.period === period));
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
  // a finished treasure map shows this map's secret landmark below the treasure
  const theme = kidTheme(kid);
  const secret = SECRETS[theme] && treasureFound(state.log, kid.id).maps.has(theme) ? SECRETS[theme] : null;
  const height = top + rows.length * MAP_ROW + (secret ? SECRET_ROOM : 0);
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
      const c = chestFor(kid, today());
      const title = c.opened ? 'Quest complete!' : c.ready ? 'Tap to open!' : `${c.tier.name}!`;
      const sub = c.opened ? `You got: ${prizeText(c.opened, mapName).title.replace(/!$/, '')}` : c.ready ? `A ${c.tier.name.toLowerCase()} for you` : s.complete ? 'See you tomorrow' : 'Finish every task';
      return `<button class="map-node chest chest-${c.tier.id} ${c.ready ? 'open ready' : c.opened ? 'opened' : ''}" style="${pos}" data-action="chest" aria-label="Treasure">
          <span class="node-icon">${chestSvg(c.tier.id, Boolean(c.opened), 3)}</span></button>
        <div class="map-label ${p.x > 50 ? 'left' : 'right'}" style="${pos};${labelWidth(p.x)}"><b>${esc(title)}</b><small>${esc(sub)}</small></div>`;
    }
    const t = r.task;
    const st = r.status === 'done' ? 'done' : r.status === 'pending' ? 'pending' : i === here ? 'current' : 'todo';
    let sub = st === 'done' ? 'Done!' : st === 'pending' ? 'Waiting for a parent' : t.verify === 'parent' ? 'Parent checks' : 'Tap when done';
    if (st !== 'done' && st !== 'pending' && t.minutes > 0) {
      const sec = entry?.tasks?.[t.id]?.seconds || 0;
      const left = t.minutes * 60 - sec;
      sub = left <= 0 ? 'Time done! Get a parent' : sec ? `${mmss(left)} left` : `${t.minutes} minute timer`;
    }
    const cue = cueFor(kid, t);
    if (cue && st !== 'done' && st !== 'pending') sub = `${cue} · ${sub}`;
    const star = habitInfo(state, kid, today()).get(t.id)?.mastered ? ' ⭐' : '';
    return `<button class="map-node ${st}" style="${pos}" data-action="task" data-id="${t.id}" aria-label="${esc(t.name)}">
        <span class="node-icon">${esc(t.icon)}</span>
        ${st === 'done' ? '<span class="node-badge">✓</span>' : st === 'pending' ? '<span class="node-badge wait">⏳</span>' : ''}
      </button>
      <div class="map-label ${p.x > 50 ? 'left' : 'right'}" style="${pos};${labelWidth(p.x)}"><b>${esc(t.name)}${star}</b><small>${esc(sub)}</small></div>`;
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
      ${secret ? `<button class="map-secret" style="top:${height - SECRET_ROOM / 2}px" data-action="secret" aria-label="${esc(secret.name)}">${secretSvg(theme, 4)}<span class="secret-name">${esc(secret.name)}</span><span class="secret-bubble" hidden></span></button>` : ''}
      ${walker}
    </section>`;
}

// The village: the same chores as the map, as quests from villagers (see village.js).
function villageView(kid, s, entry, mood) {
  const tasks = ['morning', 'afternoon'].flatMap((period) => planOrder(kid, s.tasks.filter((x) => x.period === period)));
  let current = false;
  // a kid who made their own plan sees its steps numbered, and the village follows them
  const planned = Boolean(kid.plan?.order?.length);
  const list = tasks.map((t, i) => {
    const status = entry?.tasks?.[t.id];
    let st = status?.status === 'done' ? 'done' : status?.status === 'pending' ? 'pending' : 'todo';
    if (st === 'todo' && !current) { st = 'current'; current = true; }
    let sub = st === 'done' ? 'Done!' : st === 'pending' ? 'Waiting for a parent' : t.verify === 'parent' ? 'A parent checks this one' : 'Tap "I did it" when it\'s done';
    if (st !== 'done' && st !== 'pending' && t.minutes > 0) {
      const sec = status?.seconds || 0;
      const left = t.minutes * 60 - sec;
      sub = left <= 0 ? 'Time done! Get a parent' : sec ? `${mmss(left)} left on the timer` : `${t.minutes} minute timer`;
    }
    const cue = cueFor(kid, t);
    return { id: t.id, name: t.name, icon: t.icon, period: t.period, st, sub, verify: t.verify, timer: t.minutes > 0, step: planned ? i + 1 : 0, plan: cue ? planSentence(cue, t) : '' };
  });
  // the buddy's house: where the day starts, and wherever the kid left the buddy after that
  // (its house, the music house, or out in the village)
  const place = placeOf(kid.id, today());
  if (place === 'house') return houseView(kid, list, mood);
  const prog = progressFor(kid);
  const tier = musicTier(prog);
  if (place === 'music' && tier) return musicView(kid, list, mood, tier);
  const c = chestFor(kid, today());
  // each map has its own village; a finished treasure map for it puts up its landmark
  const theme = kidTheme(kid);
  const lm = SECRETS[theme] && treasureFound(state.log, kid.id).maps.has(theme) ? SECRETS[theme] : null;
  const size = lm ? secretSize(theme) : null;
  const store = storeOpen(state, kid, today());
  return villageHtml({
    theme,
    visit: villageVisit(kid, s),
    // drawn twice as big, with fine pixels like the rest of the village
    landmark: lm ? { html: secretSvg(theme, 1, { smooth: 2 }), name: lm.name, w: size.w * 2, h: size.h * 2 } : null,
    shop: { open: store.open, left: store.left || 0 },
    kidId: kid.id,
    kidName: kid.name,
    kidColor: /^#[0-9a-f]{6}$/i.test(kid.color || '') ? kid.color : '#e03131',
    buddy: buddyHtml(kid, mood, 'mini', { background: false, live: true, idle: true }),
    tasks: list,
    planned,
    chest: { html: chestSvg(c.tier.id, Boolean(c.opened), 1), ready: c.ready, opened: Boolean(c.opened) },
    music: { tier, left: tier ? 0 : daysToMusicHouse(prog) },
  });
}

// Which look of the music house each kid has seen on this device, so a new look is
// greeted once (the first visit, and each better piano).
const MUSIC_SEEN_KEY = 'kidquest.musicSeen';
const musicHellos = new Map(); // kid id -> the look greeted while the app is open (the page keeps saying it the same way)
function musicHello(kidId, tier) {
  if (musicHellos.get(kidId) === tier) return tierInfo(tier).hello;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(MUSIC_SEEN_KEY) || '{}') || {}; } catch { seen = {}; }
  if ((seen[kidId] || 0) >= tier) return '';
  seen[kidId] = tier;
  try { localStorage.setItem(MUSIC_SEEN_KEY, JSON.stringify(seen)); } catch { /* it just says hello again */ }
  musicHellos.set(kidId, tier);
  return tierInfo(tier).hello;
}

/** Inside the music house (musichouse.js): its look for the kid's best piano, and its stations. */
function musicView(kid, list, mood, tier) {
  return musicHouseHtml({
    kidId: kid.id,
    kidName: kid.name,
    color: /^#[0-9a-f]{6}$/i.test(kid.color || '') ? kid.color : '#e03131',
    buddy: buddyHtml(kid, mood, 'mini', { background: false, live: true, idle: true }),
    tier,
    studio: studioOpen(state, kid, today()),
    hello: musicHello(kid.id, tier),
    quests: list.filter((q) => q.st === 'todo' || q.st === 'current').length,
  });
}

const musicHandlers = {
  onPiano: () => { ui.view = 'watch'; ui.watchSession = 0; ui.watchNote = ''; render(); },
  onSheets: () => openSongbook(),
  onStudio: () => openStudio(),
  onExit: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setPlace(kid.id, today(), 'out');
    cameOutOfMusic(kid.id, kidTheme(kid));
    render();
  },
  sound: () => sounds.tap(),
};
/** Inside the buddy's house (house.js): today's bed, teeth and floor chores, the trophy shelf, the furniture. */
function houseView(kid, list, mood) {
  const t = today();
  const hc = houseChores(state, kid, t);
  const chores = {};
  for (const k of ['bed', 'teeth', 'floor']) {
    const q = hc[k] && list.find((x) => x.id === hc[k].id);
    // the house looks done once the kid says it's done (a parent may still check it)
    chores[k] = q ? { id: q.id, name: q.name, icon: q.icon, st: q.st === 'current' ? 'todo' : q.st, verify: q.verify, timer: q.timer, sub: q.sub } : null;
  }
  return houseHtml({
    kidId: kid.id,
    kidName: kid.name,
    color: /^#[0-9a-f]{6}$/i.test(kid.color || '') ? kid.color : '#e03131',
    buddy: buddyHtml(kid, mood, 'mini', { background: false, live: true, idle: true }),
    layout: homeLayout(kid),
    chores,
    mess: hc.mess,
    shelf: shelfLevel(treasureFound(state.log, kid.id).trophies.size, TROPHIES.length),
    gear: bestGear(kid.owned || []),
    quests: list.filter((q) => q.st === 'todo' || q.st === 'current').length,
    tank: tankFish(kid),
    fish: bookCount(kid.fishRecords).caught,
  });
}

const houseHandlers = {
  onTask: (id, el) => onTaskTap(id, el),
  onTrophies: () => actions.trophies(),
  onLeaderboard: () => openLeaderboard(kidById(ui.kidId)),
  onTank: () => openTankPicker(kidById(ui.kidId)),
  onFishBook: () => openFishBook(kidById(ui.kidId)),
  onExit: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setInside(kid.id, today(), false);
    cameOut(kid.id, kidTheme(kid));
    render();
  },
  sound: () => sounds.tap(),
};

// ---------- the fish book and the fish tank (in the house) ----------
// The kid's biggest catch of every kind of fish (kid.fishRecords, kept by the fishing game),
// and the one they picked and named for their tank (kid.tank). See fishbook.js.

const fishImgCache = new Map();
/** A fish picture as an image URL: in color, or a dark shape for one not caught yet. */
function fishImg(id, dark = false) {
  const key = `${id}|${dark}`;
  if (!fishImgCache.has(key)) {
    const sp = fishSpecies(id);
    const pic = fishPic(sp.look, 18, 2);
    if (dark) {
      const x = pic.getContext('2d');
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#6e5a7e';
      x.fillRect(0, 0, pic.width, pic.height);
    }
    fishImgCache.set(key, pic.toDataURL());
  }
  return fishImgCache.get(key);
}

const fishDate = (key) => (key ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

function openFishBook(kid) {
  if (!kid) return;
  const recs = kid.fishRecords || {};
  const { caught, total } = bookCount(recs);
  const pages = bookPages(recs, kidTheme(kid)).map((page) => {
    const n = page.fish.filter((f) => f.record).length;
    return `
      <div class="fb-map">
        <h3>🎣 ${esc(page.name)} <small>${n} of ${page.fish.length}</small></h3>
        <div class="fb-grid ${n ? '' : 'mini'}">
          ${page.fish.map((f) => (f.record ? `
            <div class="fb-fish ${f.rare ? 'rare' : ''}">
              ${kid.tank?.species === f.id ? '<span class="fb-tank" title="In your tank">🐟</span>' : ''}
              <img src="${fishImg(f.id)}" alt="">
              <b>${esc(f.name)}</b>
              <span class="fb-size">${f.record.size} in</span>
              <small>${esc(fishDate(f.record.date))}</small>
            </div>` : `
            <div class="fb-fish none ${f.rare ? 'rare' : ''}" title="${f.rare ? 'A rare fish!' : 'Not caught yet'}">
              <img src="${fishImg(f.id, true)}" alt="">
              <b>???</b>
              <small>${f.rare ? 'A rare fish!' : 'Not caught yet'}</small>
            </div>`)).join('')}
        </div>
      </div>`;
  }).join('');
  openModal(`
    <div class="fishbook" style="--kid:${esc(kid.color)}">
      <h2>📖 ${esc(kid.name)}'s fish book</h2>
      <p class="muted small fb-count">${caught ? `${caught} of ${total} kinds of fish caught. Each one shows the biggest yet.` : `No fish yet! Go fishing with a visiting buddy: every kind you catch goes in here (${total} to find).`}</p>
      ${pages}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
}

function openTankPicker(kid) {
  if (!kid) return;
  const recs = kid.fishRecords || {};
  const mine = bookPages(recs, kidTheme(kid)).flatMap((p) => p.fish.filter((f) => f.record).map((f) => ({ ...f, mapName: p.name })));
  if (!mine.length) {
    openModal(`
      <div class="tankpick">
        <h2>🐟 Your fish tank</h2>
        <p>The tank is empty! Go fishing with a visiting buddy. Every fish you catch goes in your fish book, and then you can pick one to live here and give it a name.</p>
        <button class="btn" data-action="modal-close">OK!</button>
      </div>`);
    return;
  }
  const now = tankFish(kid);
  ui.tankPick = now?.species || mine[0].id;
  openModal(`
    <div class="tankpick" style="--kid:${esc(kid.color)}">
      <h2>🐟 Your fish tank</h2>
      <p class="muted small">Pick a fish from your fish book to swim in your tank.</p>
      <div class="tp-grid">
        ${mine.map((f) => `<button class="tp-fish ${f.id === ui.tankPick ? 'on' : ''}" data-action="tank-pick" data-species="${esc(f.id)}" aria-pressed="${f.id === ui.tankPick}">
            <img src="${fishImg(f.id)}" alt="">
            <b>${f.rare ? '⭐ ' : ''}${esc(f.name)}</b>
            <small>${f.record.size} in · ${esc(f.mapName)}</small>
          </button>`).join('')}
      </div>
      <label class="tp-name">Give it a name
        <input id="tank-name" type="text" maxlength="${NICK_MAX}" autocomplete="off" spellcheck="false" placeholder="${esc(fishSpecies(ui.tankPick)?.name || '')}" value="${esc(now?.nickname && now.nickname !== now.name ? now.nickname : '')}">
      </label>
      <div class="tp-buttons">
        <button class="btn" data-action="tank-save">Put it in the tank</button>
        ${now ? '<button class="btn ghost" data-action="tank-empty">Empty the tank</button>' : ''}
        <button class="btn ghost" data-action="modal-close">Cancel</button>
      </div>
    </div>`);
}

// ---------- the family leaderboard (the chart on the house wall) ----------
// Every family kid's best in each visitor game, this week (Sunday to Saturday) and of all time.
function openLeaderboard(kid, mode = ui.lbMode || 'week') {
  if (!kid) return;
  ui.lbMode = mode;
  const t = today();
  const kids = familyBuddies().filter((b) => b.buddy);
  const boards = leaderboard(kids, mode, t);
  const medal = (n) => ['', '🥇', '🥈', '🥉'][n] || (n ? String(n) : '');
  const games = boards.map(({ game, rows }) => `
      <div class="lb-game">
        <h3>${game.icon} ${esc(game.name)}</h3>
        ${rows.map((r) => `<div class="lb-row ${r.score ? '' : 'none'} ${r.id === kid.id ? 'me' : ''}">
            <span class="lb-place">${medal(r.place)}</span>
            <span class="lb-buddy">${buddySvg(r.buddy, r.place === 1 ? 'excited' : 'happy', { background: false })}</span>
            <span class="lb-name">${esc(r.name)}</span>
            <span class="lb-score">${r.score ? esc(game.unit(r.score)) : 'No score yet'}</span>
          </div>`).join('')}
      </div>`).join('');
  const sat = addDays(weekOf(t), 6);
  openModal(`
    <div class="leaderboard" style="--kid:${esc(kid.color)}">
      <h2>📊 Family game scores</h2>
      <div class="lb-tabs">
        <button class="btn ${mode === 'week' ? 'on' : 'ghost'}" data-action="lb-mode" data-mode="week">This week</button>
        <button class="btn ${mode === 'all' ? 'on' : 'ghost'}" data-action="lb-mode" data-mode="all">All time</button>
      </div>
      <p class="muted small lb-note">${mode === 'week' ? `Best scores since Sunday. A new week starts ${sat === t ? 'tonight at midnight' : 'Sunday at midnight'}.` : 'Everyone\'s best score ever.'} Play with visiting buddies to get on the chart!</p>
      ${games}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
}

/** Today's visitors for the village green: the same ones, lines, games and gear as on the map. */
function villageVisit(kid, s) {
  const { visitors, lines, news } = visitorInfo(kid, s);
  if (!visitors.length) return null;
  const plan = visitPlan(kid, visitors);
  const areaOf = (id) => plan.areas.find((a) => a.members.includes(id));
  const version = (tier) => ['regular', 'good', 'super'][tier - 1];
  const playable = playableFor(kid, s.complete);
  return {
    host: kid.id,
    visitors: visitors.map((v, i) => {
      const area = areaOf(v.id);
      const gear = bestGear(v.owned);
      let look = dressedVisitor(v);
      if (area?.kind === 'pond') look = dressedVisitor(v, { ...v.buddy, outfit: { ...v.buddy.outfit, music: undefined, sport: `sport-rod-${version(gear.rod)}` } });
      else if (area) look = dressedVisitor(v, { ...v.buddy, outfit: { ...v.buddy.outfit, music: undefined, sport: area.kind === 'hockey' ? `sport-hockey-${version(gear.hockey || 1)}` : undefined } });
      return { id: v.id, name: v.name, color: v.color, rod: gear.rod || 1, line: lines[i], news: news[v.id] || '', html: liveHtml(`visit:${v.id}`, look, { background: false, feel: visitFeel(area, s.complete), label: `${v.name}'s buddy` }) };
    }),
    areas: plan.areas.map((a) => {
      const tiers = a.members.map((id) => bestGear(visitors.find((v) => v.id === id).owned)[a.kind] || 1);
      if (a.host) tiers.push(bestGear(kid.owned || [])[a.kind] || 1);
      return { side: a.side, kind: a.kind, members: a.members, ball: a.kind === 'pond' ? '' : ballSvg(a.kind, Math.max(...tiers)), tap: Boolean(a.host && playable > 0 && a.kind !== 'pond') };
    }),
  };
}

/** A finished treasure map's landmark in the village: it talks, and its show plays over the view. */
function villageLandmark(el, layer) {
  const kid = kidById(ui.kidId);
  const theme = kid ? kidTheme(kid) : 'bg-meadow';
  const info = SECRETS[theme];
  if (!info || !kid || !layer) return;
  const bubble = el.querySelector('.v-lm-bubble');
  bubble.textContent = info.lines[(ui.secretLine = ((ui.secretLine ?? -1) + 1) % info.lines.length)];
  bubble.hidden = false;
  clearTimeout(bubble.hideTimer);
  bubble.hideTimer = setTimeout(() => { bubble.hidden = true; }, 3500);
  if (showPlaying(layer) || Date.now() - (ui.lastShow || 0) < SHOW_AGAIN_MS) { sounds.tap(); return; }
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buddySvg(dressed(kid), 'excited', { background: false }))}`;
  const r = el.getBoundingClientRect(); const lr = layer.getBoundingClientRect();
  const scale = Number(layer.dataset.scale) || 3;
  const def = playShow(layer, theme, { buddy: img, scale, spot: { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top }, onDone: () => layer.closest('.village')?.classList.remove('show-on') });
  if (!def) return;
  ui.lastShow = Date.now();
  layer.closest('.village')?.classList.add('show-on');
  if (state.settings.sound !== false) playShowAudio(theme, { music: state.settings.music !== false, sfx: def.sfx });
}

const villageHandlers = {
  onTask: (id, el) => onTaskTap(id, el),
  onChest: (el) => actions.chest(el),
  onVisitor: (el) => actions.visitor(el),
  onLandmark: (el, layer) => villageLandmark(el, layer),
  fishCatch: (rod, theme) => catchFor(theme || 'bg-meadow', rod),
  onShop: () => actions.wardrobe(),
  onHome: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setInside(kid.id, today(), true);
    cameIn(kid.id);
    render();
  },
  onMusic: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setPlace(kid.id, today(), 'music');
    cameInMusic(kid.id);
    render();
  },
  sound: (name) => (name === 'talk' ? sounds.tap() : sounds.tap()),
};

function viewKid() {
  const kid = kidById(ui.kidId);
  if (!kid) { ui.view = 'home'; return viewHome(); }
  const t = today();
  const { s, info } = kidSummary(kid);
  const xp = totalXp(state, kid, t);
  const lv = levelFor(xp);
  const entry = entryFor(state, kid.id, t);
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 100;
  const mood = moodFor(kid);
  const villageMode = state.settings.questView === 'village';
  const newCount = (kid.newItems || []).length;
  const exTasks = tasksForDay(state, kid, t, t).filter(isExercise);
  const late = lateChest(kid);
  return `
    <div class="screen kid" style="--kid:${kid.color}">
      <header class="kid-head">
        <button class="btn ghost round" data-action="home" aria-label="Back">←</button>
        <div class="kid-title"><b>${esc(kid.name)}</b><small>Level ${lv.level} · <span class="xpbar"><span style="width:${lv.into}%"></span></span></small></div>
        <div class="chips">
          <span class="chip fire ${info.streak ? '' : 'cold'}" title="Streak (best ${info.best})">🔥 ${info.streak}</span>
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
          ${late ? `<button class="btn late-chest" data-action="chest" data-day="${late.key}">${chestSvg(late.tier.id, false, 2)} A chest from ${late.key === addDays(t, -1) ? 'yesterday' : 'earlier'} is waiting! Open it</button>` : ''}
          <button class="btn ghost" data-action="trophies">🏆 Trophies &amp; treasure maps</button>
          ${storeOpen(state, kid, t).open
            ? `<button class="btn ghost" data-action="wardrobe">👕 Dress up ${esc(kid.name)}'s buddy${newCount ? ` <span class="badge">new</span>` : ''}</button>`
            : `<button class="btn ghost store-locked" data-action="wardrobe">🔒 Buddy store opens when today's chores are done</button>`}
        </div>
      </div>
      ${exerciseSection(kid, exTasks, entry)}
      <div class="view-toggle">
        <button class="${villageMode ? '' : 'on'}" data-action="quest-mode" data-mode="map">🗺️ Map</button>
        <button class="${villageMode ? 'on' : ''}" data-action="quest-mode" data-mode="village">🏘️ Village</button>
      </div>
      ${!state.settings.sound ? '' : `<button class="btn ghost round music-toggle" data-action="music-toggle" aria-label="${state.settings.music === false ? 'Turn music on' : 'Turn music off'}">${state.settings.music === false ? '🔇' : '🎵'}</button>`}
      ${familyBanner()}
      ${villageMode ? villageView(kid, s, entry, mood) : questMap(kid, s, entry, mood)}
      <section>
        <h2>This week</h2>
        ${streakLine(kid, info)}
        ${weekDots(kid, info)}
        ${rewardLine(kid)}
        ${monthLine(kid)}
        ${weekCoinsHtml(kid)}
        <p class="muted small">Finish 7 days in a row to earn a streak freeze ❄️ (you can save up to 2). A freeze protects your streak if you miss a day. Miss a day without one and you lose a quarter of your streak (at least 1 day), not all of it, and finishing the next day earns a welcome-back bonus.</p>
      </section>
      ${habitsSection(kid)}
    </div>`;
}

/** "🔥 Streak 5 days · 🏆 Best 12 days" (plus the piano streak when there is one). */
function streakLine(kid, info) {
  const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const piano = pianoStreakInfo(state, kid, today());
  return `<p class="streak-line"><span>🔥 Streak <b>${days(info.streak)}</b></span><span>🏆 Best <b>${days(info.best)}</b></span>${piano.perWeek ? `<span>🎹 Piano <b>${days(piano.streak)}</b> (best ${piano.best})</span>` : ''}</p>`;
}

/** How this week's real-world reward is going: it lands on Friday when Monday to Friday are all done. */
function rewardLine(kid) {
  const name = state.settings.weeklyReward?.trim();
  if (!name) return '';
  const t = today();
  const r = weeklyRewardInfo(state, kid, t);
  if (r.earned) return `<p class="reward-line earned">🏆 <b>Weekly reward earned: ${esc(name)}!</b> Show a parent.</p>`;
  if (r.lost) {
    return t > r.friday
      ? `<p class="reward-line">🏆 Next week: do every chore Monday to Friday to earn <b>${esc(name)}</b>.</p>`
      : `<p class="reward-line">🏆 This week's reward got away, but <b>${esc(name)}</b> is back next week. Keep going!</p>`;
  }
  const ok = r.days.filter((d) => d.state === 'done' || d.state === 'excused').length;
  const of = r.days.filter((d) => d.state !== 'before').length;
  return `<p class="reward-line">🏆 Do every chore Monday to Friday and on Friday you get: <b>${esc(name)}</b>. <b>${ok} of ${of}</b> days done.</p>`;
}

/** "This month: 18 of 20 days done 💪" */
function monthLine(kid) {
  const m = monthDays(state, kid, today());
  if (m.days < 3) return '';
  return `<p class="month-line"><b>This month: ${m.done} of ${m.days} days done</b>${m.done === m.days ? ' 🌟' : m.done / m.days >= 0.8 ? ' 💪' : ''}</p>`;
}

/**
 * Habits: each task that comes up often enough, with how close it is to being
 * mastered (done on 85% of its days over 60 days). Mastered ones get a star.
 */
function habitsSection(kid) {
  const habits = [...habitInfo(state, kid, today()).values()];
  if (!habits.length) return '';
  const rows = planOrder(kid, habits.map((h) => h.task)).map((t) => habits.find((h) => h.task.id === t.id)).map((h) => {
    const pct = Math.min(100, Math.round((h.done / h.goal) * 100));
    return `<div class="habit-row ${h.mastered ? 'mastered' : ''}">
        <span class="habit-icon">${esc(h.task.icon)}</span>
        <span class="habit-text"><b>${esc(h.task.name)}</b>
          ${h.mastered ? `<small class="stars">${'⭐'.repeat(Math.min(5, h.stars.length))}${h.stars.length > 5 ? ` ×${h.stars.length}` : ''} Mastered habit!</small>` : ''}
          <span class="bar habit-bar"><span style="width:${pct}%"></span></span><small>${h.done} of ${h.goal} toward ${h.mastered ? 'the next star' : 'a star'}</small>
        </span>
      </div>`;
  }).join('');
  return `
      <section class="habits">
        <h2>⭐ Habits <small class="muted">do it ${Math.round(0.85 * 100)}% of days for 60 days</small></h2>
        <button class="btn ghost plan-btn" data-action="plan" data-kid="${kid.id}">📝 Plan my day</button>
        ${rows}
        <p class="muted small">Stars stay for good, and each 60 days you keep a habit up earns another. Your weekly coins stay the same: a mastered habit's share goes to the habits you're still building.</p>
      </section>`;
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
        <div class="kid-title"><b>${esc(kid.name)}'s buddy</b><small>Streak ${prog.streak} days · best ${prog.best}${prog.pianoPerWeek ? ` · 🎹 Piano streak ${prog.piano} days (best ${prog.pianoBest})` : ''}</small></div>
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
    const on = item.home ? isPlaced(kid, item) : kid.buddy.outfit[item.slot] === item.id;
    // the wand's picture is lit all the way, to show what it does
    const preview = { ...kid.buddy, wand: 1, outfit: item.slot === 'background' ? { background: item.id } : { background: 'none', [item.slot]: item.id } };
    const wearing = item.home ? (on ? 'In your house' : 'Tap to use') : item.slot === 'sport' ? (on ? 'Holding' : 'Tap to hold') : (on ? 'Wearing' : 'Tap to wear');
    const price = item.gems ? `<span class="price gems ${prog.gems >= item.gems ? 'can' : ''}">💎 ${item.gems}</span>`
      : item.price ? `<span class="price ${prog.coins >= item.price ? 'can' : ''}">🪙 ${item.price}</span>` : '';
    return `<button class="item ${open ? '' : 'locked'} ${item.price || item.gems ? 'shop' : ''} ${item.species ? 'special' : ''} ${on ? 'on' : ''}" data-action="wardrobe-item" data-id="${item.id}">
            ${item.species ? `<span class="special-tag">⭐ ${esc(speciesName(item.species))} only</span>` : ''}
            ${item.home ? `<span class="spot-tag">${spotById(item.spot).icon} ${esc(spotById(item.spot).name)}</span>` : ''}
            <span class="item-art">${item.home ? `<img class="home-thumb" src="${homeThumb(item.id)}" alt="">` : buddySvg(preview, 'happy', { background: item.slot === 'background' })}</span>
            <span class="item-name">${esc(item.name)}${fresh.has(item.id) ? ' <span class="badge">new</span>' : ''}</span>
            <small>${open ? wearing : price || `🔒 ${esc(needLabel(item))}`}</small>
            ${!open && item.need?.pianoWeeks ? `<small class="piano-need">${Math.min(prog.pianoBest, pianoDaysNeeded(item, prog))} of ${pianoDaysNeeded(item, prog)} piano days</small>` : ''}
          </button>`;
  }).join('')}
      </div>
      ${sportTab ? movesList(kid, prog) : ''}
      ${ui.slot === 'music' ? `<p class="muted small">Do piano every time it's on your list to grow your piano streak (a day off from piano doesn't break it). Your best piano streak is ${prog.pianoBest} days.</p>` : ''}
      ${sportTab ? `<p class="muted small">Only exercise earns 💎 gems, and only gems buy sports gear. Gear works with every buddy. Exercise on ${prog.ex.goal} days in a week to keep your exercise streak going: 1, 3 and 6 weeks in a row unlock new moves for each piece of gear you own, and moves stay yours even if the streak ends. Tap your buddy to see a move. Visiting buddies with a fishing rod go fishing!</p>` : ''}
      ${ui.slot === 'home' ? '<p class="muted small">Every task you finish earns coins to spend on furniture. Furniture goes in your buddy\'s house, and every buddy you have can use it. Each spot holds one thing at a time: tap something you own to put it in, or tap it again to take it out. Walk your buddy in the front door of your house in the village to see it!</p>' : ''}
      ${sportTab || ui.slot === 'home' ? '' : `<p class="muted small">Every task you finish earns coins. Spend them on anything with a 🪙 price. Hats, glasses and extras you buy belong to the buddy wearing them, so a new buddy needs its own. Places and streak prizes work with every buddy. Streak prizes can't be bought: keep your streak going to win them, and they stay yours even if a streak ends. Tap an item again to take it off.</p>`}
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
    const reward = state.settings.weeklyReward?.trim() && weeklyRewardInfo(state, kid, t).earned ? ` · 🏆 earned ${state.settings.weeklyReward.trim()}` : '';
    return `
        <div class="list-row">
          ${buddyChip(kid)}
          <div class="grow"><b>${esc(kid.name)}</b><small class="muted">${week}${esc(reward)}</small></div>
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

/** Buttons to add a ready-made house chore (name, morning, linked to the house) that the kid doesn't have yet. */
function houseAdds(kid) {
  const missing = HOUSE_CHORES.filter((c) => !kid.tasks.some((t) => t.house === c.id));
  if (!missing.length) return '';
  return `<div class="row wrap house-adds"><small class="muted">🏠 Add a house chore:</small>${missing.map((c) => `<button class="btn ghost small-btn" data-action="add-house-task" data-house="${c.id}">+ ${c.icon} ${esc(c.label)}</button>`).join('')}</div>`;
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
        ${isExercise(t) ? '' : `<label>House chore <select data-action-change="task-house" data-task="${t.id}" aria-label="House chore">
          <option value="" ${t.house ? '' : 'selected'}>None</option>
          ${HOUSE_CHORES.map((c) => `<option value="${c.id}" ${t.house === c.id ? 'selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('')}
        </select></label>`}
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
    ${houseAdds(kid)}
    <h2>☀️ After-school tasks</h2>
    ${taskRows('afternoon')}
    <button class="btn ghost" data-action="add-task" data-period="afternoon">+ Add after-school task</button>
    <h2>💪 Bonus exercise</h2>
    ${taskRows('exercise') || '<p class="muted small">None yet. Add a run, a bike ride, soccer practice or anything active.</p>'}
    <button class="btn ghost" data-action="add-task" data-period="exercise">+ Add exercise task</button>
    <p class="muted small">Exercise tasks are optional: they never count toward the streak or the day's treasure. Each one earns ${DEFAULT_GEMS} 💎 gems unless you type another amount. Gems only buy sports gear. Exercising on ${EXERCISE_DAYS} days in a week keeps the exercise streak going, which unlocks moves for the kid's buddy at 1, 3 and 6 weeks. A day you excuse in Past days (sick, travel) counts neither for nor against it: that week just needs one fewer exercise day, and a week with 5 or more excused days is skipped. You can excuse days afterwards too, and streaks update right away.</p>
    <p class="muted small">🏠 House chores show in ${esc(kid.name)}'s buddy house in the village: an unmade bed until “Make bed” is done, the toothbrush out until the morning “Brush teeth” is done, and a messy floor until “Pick up bedroom floor” is done (messier after 2 days, very messy after 4). Pick which task is which with “House chore”, or add one ready-made. Each can be linked to one task at a time. Tasks that aren't linked don't change the house.</p>
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
      <label class="block">Weekly reward (on Friday, for a kid who did every chore Monday to Friday; excused days don't count against it)
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
${gameTestCard()}
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
const furnitureName = (id) => (itemById(id)?.name || 'furniture').toLowerCase();

// furniture pictures for the shop, drawn once each (houseart.js)
const thumbs = new Map();
function homeThumb(id) {
  if (!thumbs.has(id)) thumbs.set(id, furnitureThumb(document, id)?.toDataURL() || '');
  return thumbs.get(id);
}

function buyGear(kid, item, prog) {
  if (prog.gems < item.gems) {
    sounds.error();
    toast(`${item.gems - prog.gems} more gems to go! Exercise to earn them. 💪`);
    return;
  }
  const preview = { ...dressed(kid), outfit: { ...kid.buddy.outfit, sport: item.id } };
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
  const preview = { ...kid.buddy, wand: 1, outfit: { ...kid.buddy.outfit, [item.slot]: item.id } };
  openModal(`
    <div class="celebrate">
      ${item.home ? `<div class="buddy buddy-xl home-buy"><img class="home-thumb" src="${homeThumb(item.id)}" alt=""></div>` : `<div class="buddy buddy-xl mood-happy">${buddySvg(preview, 'happy')}</div>`}
      <h1>Buy ${esc(item.name)}${isWorn(item) ? ` for your ${esc(speciesName(kid.buddy.species).toLowerCase())}` : item.home ? ' for your house' : ''}?</h1>
      <p>It costs <b>🪙 ${item.price}</b>. You'll have ${prog.coins - item.price} coins left.</p>
      ${item.note ? `<p>${esc(item.note)}</p>` : ''}
      ${item.species ? `<p class="muted small">⭐ A special made just for ${esc(speciesName(item.species).toLowerCase())}s. Every kind of buddy has its own.</p>`
    : isWorn(item) ? '<p class="muted small">Only this buddy can wear it. Other buddies need their own.</p>'
      : item.home ? `<p class="muted small">It goes in your buddy's house (${esc(spotById(item.spot).name.toLowerCase())}), for every buddy you have.</p>` : ''}
      <div class="stack">
        <button class="btn huge" data-action="buy-confirm" data-id="${item.id}">Buy it!</button>
        <button class="btn ghost" data-action="modal-close">Keep saving</button>
      </div>
    </div>`);
}

const views = { setup: viewSetup, home: viewHome, kid: viewKid, timer: viewTimer, watch: viewWatch, songbook: viewSongbook, studio: viewStudio, parent: viewParent, wardrobe: viewWardrobe, listen: viewListen };

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
  if (cloudCfg && !cloud.gotState) return false;
  let changed = false;
  if (!state.settings.allowance) {
    state.settings.allowance = { ...defaultAllowance(addDays(today(), 1)), startFixed: true };
    changed = true;
  } else if (repairAllowanceStart(state)) {
    changed = true;
  }
  if (applyGrants(state)) changed = true;
  return changed;
}

/** First run with the shop: keep anything the kid had already reached by level, for free. */
function giveLegacyItems(kid) {
  if (Array.isArray(kid.owned)) return false;
  const lv = levelFor(totalXp(state, kid, today()));
  kid.owned = ITEMS.filter((i) => i.price && LEGACY_LEVEL(i) <= lv.level).map((i) => i.id);
  kid.spent = 0;
  moveWornToBuddy(kid);
  return true;
}

/**
 * Everything that keeps the saved data up to date before a redraw (the
 * allowance, one-time repairs, what other devices read about each kid, today's
 * task list), saved once. The views themselves only read.
 */
function reconcile() {
  let changed = stampAllowance();
  for (const k of state.kids) if (giveLegacyItems(k)) changed = true;
  if (shareToday()) changed = true;
  const kid = ui.view === 'kid' && kidById(ui.kidId);
  if (kid) {
    // keep today's tasks and their pay as they are now, for the history
    snapshotToday(state, kid, today());
    changed = true; // save() only sends it if it actually changed
  }
  if (changed) save();
}

function render() {
  const scrollY = window.scrollY;
  // the store closes again on a new day, even if the wardrobe was left open overnight
  if (ui.view === 'wardrobe' && !storeOpen(state, kidById(ui.kidId), today()).open) ui.view = 'kid';
  const keepScroll = ui.view === 'parent' || ui.view === 'wardrobe' || ui.view === 'songbook' || ui.view === 'studio';
  if (ui.view === 'kid' && lastView !== 'kid') partyDue = true; // the map just opened
  const html = withMemo(() => { reconcile(); return (views[ui.view] || viewHome)(); });
  // load the sign-in code early, so a sign-in popup opens straight from the tap
  if (ui.view === 'setup' || (ui.view === 'parent' && ui.tab === 'settings')) loadCloud().catch(() => {});
  // Family sync can ask for a redraw many times a minute (another tablet saving, a piano timer
  // ticking). When nothing on screen changed, leave the page alone: the visitors don't arrive
  // again, the fish keep swimming and a half-scrolled row stays where it is.
  if (html === lastHtml && $app.firstElementChild) { syncMusic(); maybeParty(); greetCheers(); return; }
  const sameView = lastView === ui.view;
  const side = sameView ? [...$app.querySelectorAll(SIDE_SCROLLERS)].map((el) => el.scrollLeft) : [];
  $app.innerHTML = html;
  lastHtml = html;
  lastView = ui.view;
  $app.querySelectorAll(SIDE_SCROLLERS).forEach((el, i) => { if (side[i]) el.scrollLeft = side[i]; });
  paintQuestMaps($app);
  mountVillages($app, villageHandlers);
  mountHouses($app, houseHandlers);
  mountMusicHouses($app, musicHandlers);
  mountSongbook($app);
  mountStudio($app);
  liveStart();
  syncMusic();
  if (keepScroll) window.scrollTo(0, scrollY);
  maybeParty();
  greetCheers();
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
  'timer-start': () => { wakeEars(); startTimer(true); startEars(); },
  'timer-pause': () => { stopEars(); stopTimer(); },
  'timer-buddy': () => buddyCheer(),
  'timer-back': () => { stopEars(); stopTimer(false); ui.view = 'kid'; render(); },
  'watch-back': () => { stopEars(); stopTimer(false); ui.view = 'kid'; render(); },
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
  'listen-kid': (el) => { ui.listenKid = el.dataset.id; setLastListenMood(''); render(); },
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
  wardrobe: () => {
    const lock = storeOpen(state, kidById(ui.kidId), today());
    if (!lock.open) { sounds.error(); toast(lock.left ? `🔒 Finish today's chores first (${lock.left} to go)` : `🔒 Opens when a parent approves your chores (${lock.waiting} waiting)`); return; }
    ui.view = 'wardrobe'; render(); window.scrollTo(0, 0);
  },
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
    if (item.home) {
      // furniture: put it in its spot in the house (tap again to take it out)
      const was = isPlaced(kid, item);
      kid.home = placeFurniture(kid, item);
      kid.newItems = (kid.newItems || []).filter((id) => id !== item.id);
      sounds.task(); save(); render();
      toast(was ? (spotById(item.spot).basic ? `Back to the ${furnitureName(spotById(item.spot).basic)}` : `${item.name} put away`) : `${item.name} is in your house! 🏠`);
      return;
    }
    const outfit = kid.buddy.outfit;
    if (outfit[item.slot] === item.id && item.slot !== 'background') delete outfit[item.slot];
    else { outfit[item.slot] = item.id; putAwayOther(kid, item.slot); }
    kid.newItems = (kid.newItems || []).filter((id) => id !== item.id);
    sounds.task(); save(); render();
  },
  'music-toggle': () => { state.settings.music = state.settings.music === false; save(); render(); },
  'quest-mode': (el) => { state.settings.questView = el.dataset.mode; save(); render(); },
  chest: (el) => {
    const kid = kidById(ui.kidId);
    const key = el.dataset.day || today();
    const c = chestFor(kid, key);
    if (c.ready) return openChest(kid, key);
    if (c.opened) { sounds.day(); confetti(60, 1500); toast(`Today's treasure: ${prizeText(c.opened, mapName).title}`); return; }
    sounds.tap();
    if (c.s.complete) toast('See you tomorrow for another chest!');
    else toast(`${c.s.total - c.s.done} more to reach the ${c.tier.name.toLowerCase()}!`);
  },
  trophies: () => openTrophies(kidById(ui.kidId)),
  secret: (el) => {
    const kid = kidById(ui.kidId);
    const theme = kidTheme(kid);
    const info = SECRETS[theme];
    const section = el.closest('.quest-map');
    if (!info || !section) return;
    // the landmark wakes up and says something
    el.classList.add('awake');
    clearTimeout(el.sleepTimer);
    el.sleepTimer = setTimeout(() => el.classList.remove('awake'), 3500);
    const bubble = el.querySelector('.secret-bubble');
    bubble.textContent = info.lines[(ui.secretLine = ((ui.secretLine ?? -1) + 1) % info.lines.length)];
    bubble.hidden = false;
    clearTimeout(bubble.hideTimer);
    bubble.hideTimer = setTimeout(() => { bubble.hidden = true; }, 3500);
    if (showPlaying(section) || Date.now() - (ui.lastShow || 0) < SHOW_AGAIN_MS) { sounds.tap(); return; }
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buddySvg(dressed(kid), 'excited', { background: false }))}`;
    const spot = { x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 };
    const def = playShow(section, theme, { buddy: img, spot, onDone: () => section.classList.remove('show-on') });
    if (!def) return;
    ui.lastShow = Date.now();
    section.classList.add('show-on');
    if (state.settings.sound !== false) playShowAudio(theme, { music: state.settings.music !== false, sfx: def.sfx });
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
    // furniture goes straight into its spot in the house; anything else, the buddy puts on
    if (item.home) kid.home = { ...(kid.home || {}), [item.spot]: item.id };
    else {
      kid.buddy.outfit[item.slot] = item.id;
      putAwayOther(kid, item.slot);
    }
    save();
    closeModal();
    sounds.day();
    confetti(80, 1600);
    toast(`${item.name} is yours!`);
    render();
    if (item.gems) setTimeout(() => showUnlocks(currentKid(kid)), 700);
  },
  'try-move': (el) => {
    const kid = kidById(ui.kidId);
    const tap = document.querySelector('.wardrobe-top .buddy-tap');
    if (kid && tap) { tap.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); doMove(tap, mover(kid), el.dataset.move); }
  },
  'move-locked': (el) => { sounds.error(); toast(`🔒 ${el.dataset.need}`); },
  'unlock-try': (el) => { closeModal(); ui.slot = el.dataset.slot; actions.wardrobe(); },
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
  'add-house-task': (el) => {
    const kid = kidById(ui.editKidId);
    const role = el.dataset.house;
    if (!kid || !houseChoreById(role)) return;
    const task = houseTask(role, newId('task'));
    kid.tasks.push(task);
    const cleared = setHouseRole(kid.tasks, task.id, role);
    save(); render();
    if (cleared.length) toast(`“${cleared[0].name}” is no longer the house's ${houseChoreById(role).label.toLowerCase()} chore`);
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
  if (act === 'task-house') {
    const kid = kidById(ui.editKidId);
    if (!kid) return;
    const cleared = setHouseRole(kid.tasks, el.dataset.task, el.value || null);
    save(); render();
    if (cleared.length) toast(`“${cleared[0].name}” is no longer the house's ${houseChoreById(el.value).label.toLowerCase()} chore`);
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
      onYes: () => { setState(migrate(data)); setSound(state.settings.sound); save(); ui.view = 'home'; render(); toast('Backup restored'); },
    });
  });
}

// ---------- family sync (see sync-ui.js) ----------

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
  // a visitor with news (or who came to cheer) keeps talking
  all.forEach((el) => el.classList.toggle('talking', el === next || el.classList.contains('news') || el.classList.contains('cheering')));
}
setInterval(() => { if (document.visibilityState === 'visible') nextVisitorTalks(); }, 4000);
actions.visitor = (el) => {
  const v = familyBuddies().find((b) => b.id === el.dataset.id);
  const kid = kidById(el.closest('.map-visitors')?.dataset.host);
  // once the day's quest is done, visitors want to play
  if (v && kid) {
    const s = dayStatus(state, kid, today(), today());
    if (playableFor(kid, s.complete) > 0) {
      sounds.tap();
      // the kid's own field starts its game; a visitor offers what there is to play
      const games = gamesWith(kid, v, visitPlan(kid, todaysVisitors(kid)));
      if (el.dataset.pick) playWith(kid, v, el.dataset.pick);
      else if (games.length === 1) playWith(kid, v, games[0]);
      else pickGame(kid, v, games);
      return;
    }
    if (s.complete) el.querySelector('.visitor-bubble').textContent = "That's all our games today! See you tomorrow";
    else {
      const left = s.total - s.done;
      el.querySelector('.visitor-bubble').textContent = `Finish your quest and let's play! ${left} to go`;
    }
  }
  nextVisitorTalks(el);
  if (!v || !doMove(el, { ...v, buddy: dressedVisitor(v) })) { sounds.tap(); live(`visit:${el.dataset.id}`).giggle(); }
};

// ---------- playing with a visitor (see play-ui.js) ----------

// the leaderboard's This week / All time tabs
Object.assign(actions, songbookActions);
Object.assign(actions, studioActions);
actions['lb-mode'] = (el) => openLeaderboard(kidById(ui.kidId), el.dataset.mode);

actions['tank-pick'] = (el) => {
  ui.tankPick = el.dataset.species;
  $modal.querySelectorAll('.tp-fish').forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-pressed', String(b === el)); });
  const input = $modal.querySelector('#tank-name');
  if (input) input.placeholder = fishSpecies(ui.tankPick)?.name || '';
};
actions['tank-save'] = () => {
  const kid = kidById(ui.kidId);
  const tank = kid && makeTank(kid.fishRecords, ui.tankPick, $modal.querySelector('#tank-name')?.value);
  if (!tank) return;
  kid.tank = tank;
  save();
  closeModal();
  sounds.tap();
  toast(`🐟 ${tankFish(kid)?.nickname || 'Your fish'} is in the tank!`);
  render();
};
actions['tank-empty'] = () => {
  const kid = kidById(ui.kidId);
  if (!kid) return;
  delete kid.tank;
  save();
  closeModal();
  render();
};

actions['play-pick'] = (el) => {
  const v = familyBuddies().find((b) => b.id === el.dataset.id);
  const kid = kidById(el.dataset.host);
  closeModal();
  if (v && kid && GAME_NAMES[el.dataset.kind]) playWith(kid, v, el.dataset.kind);
};

// Settings > Try the games: a parent plays any visitor game right away, with
// any gear, to see how it feels. It doesn't count toward the daily limit or records.
const TIER_NAMES = ['No gear', 'Regular', 'Good', 'Super'];
function gameTestCard() {
  const kids = state.kids;
  if (!kids.length) return '';
  const opt = (sel, list) => list.map(([v, label]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const who = kids.map((k) => [k.id, `${k.name}'s buddy`]);
  const tiers = TIER_NAMES.map((n, i) => [String(i), n]);
  return `
    <div class="card game-test">
      <h2>🎮 Try the games</h2>
      <p class="muted small">Play a visitor game right away to see how it feels. Gear means the ball, stick, football, fishing rod or running shoes for that game. Nothing counts toward the daily limit or anyone's best.</p>
      <div class="game-test-pick">
        <label>Playing <select id="gt-kid">${opt(ui.gtKid || kids[0].id, who)}</select></label>
        <label>Their gear <select id="gt-kid-gear">${opt(ui.gtKidGear || '1', tiers)}</select></label>
        <label>Visitor <select id="gt-vis">${opt(ui.gtVis || (kids[1] || kids[0]).id, who)}</select></label>
        <label>Visitor's gear <select id="gt-vis-gear">${opt(ui.gtVisGear || '1', tiers)}</select></label>
        <label>Fishing spot <select id="gt-map">${opt(ui.gtMap || kidTheme(kids[0]), Object.entries(FISH_SPOTS).map(([id, sp]) => [id, sp.name]))}</select></label>
      </div>
      <div class="row wrap">
        ${['soccer', 'tag', 'hockey', 'football', 'fishing'].map((k) => `<button class="btn" data-action="game-test" data-kind="${k}">${GAME_NAMES[k]}</button>`).join('')}
      </div>
    </div>`;
}

actions['game-test'] = (el) => {
  const kind = el.dataset.kind;
  const val = (id) => document.getElementById(id)?.value;
  Object.assign(ui, { gtKid: val('gt-kid'), gtKidGear: val('gt-kid-gear'), gtVis: val('gt-vis'), gtVisGear: val('gt-vis-gear'), gtMap: val('gt-map') });
  const kid = kidById(ui.gtKid) || state.kids[0];
  const other = kidById(ui.gtVis) || kid;
  const gearKind = kind === 'tag' ? 'shoes' : kind === 'fishing' ? 'rod' : kind;
  const gear = (tier) => (Number(tier) ? { [gearKind]: Number(tier) } : {});
  // the same kid on both sides still needs two names
  const visName = other.id === kid.id ? 'Visitor' : other.name;
  sounds.tap();
  openPlay({
    kind,
    best: 0,
    kid: { buddy: kid.buddy, name: kid.name, gear: gear(ui.gtKidGear), moves: moveIds(mover(kid)) },
    visitor: { buddy: other.buddy, name: visName, gear: gear(ui.gtVisGear), moves: moveIds(mover(other)) },
    map: ui.gtMap || kidTheme(kid),
    day: today(),
    sounds,
  });
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
  if (t !== lastDay) { lastDay = t; if (!timerOnScreen()) render(); }
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
    if (!hadController || reloading || ui.view === 'timer' || ui.view === 'watch') return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update()).catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});

// what the modules split out of app.js share (see ctx.js)
provide({
  ui, $modal, today, esc, kidById, taskById, liveKey, dressed,
  save, render, viewKid, markDone, askParentNowOrLater,
  toast, actions, openModal, closeModal, confirmModal,
  cloud, cloudCfg, family, store, CLOUD_KEY, CLOUD_CACHE_KEY, BUDDIES_KEY,
  currentKid, buddyHtml, progressFor, mover, doMove, exerciseInfo, kidTheme,
});

restoreTimer();
render();
startEars();
if (cloudCfg) startCloud();

Object.assign(actions, {
  plan: (el) => { const kid = kidById(el.dataset.kid); if (kid) openPlan(kid); },
  'plan-move': (el) => {
    const kid = kidById(ui.planKid);
    const d = ui.planDraft;
    if (!kid || !d) return;
    // move it past the next task of the same time of day
    const task = kid.tasks.find((x) => x.id === el.dataset.id);
    const same = planOrder({ plan: d }, questTasks(kid.tasks).filter((x) => x.period === task.period)).map((x) => x.id);
    const i = same.indexOf(task.id);
    const j = i + Number(el.dataset.dir);
    if (j < 0 || j >= same.length) return;
    [same[i], same[j]] = [same[j], same[i]];
    const others = d.order.filter((id) => !same.includes(id));
    d.order = [...same, ...others];
    planModal(kid);
  },
  'plan-save': (el) => {
    const kid = kidById(el.dataset.kid);
    const d = ui.planDraft;
    if (!kid || !d) return;
    const cues = Object.fromEntries(Object.entries(d.cues).filter(([, c]) => c));
    kid.plan = { order: planOrder({ plan: d }, questTasks(kid.tasks)).map((x) => x.id), cues, week: weekStart(today()) };
    save();
    ui.planDraft = null;
    closeModal();
    render();
    toast('Plan saved! 📝');
  },
  'family-party': () => { if (familyToday().happy) startParty(); },
  'send-cheer': (el) => {
    const kid = kidById(el.closest('.map-visitors')?.dataset.host);
    sendCheer(kid, familyBuddies().find((b) => b.id === el.dataset.id));
  },
});

// the "dance earlier" slider: takes effect at once, and is kept on this tablet
document.addEventListener('input', (e) => {
  if (!e.target.matches?.('[data-dance-lead]')) return;
  ui.danceLead = Math.min(DANCE_LEAD.max, Math.max(DANCE_LEAD.min, Number(e.target.value) || 0));
  try { localStorage.setItem(DANCE_LEAD_KEY, String(ui.danceLead)); } catch { /* lasts while the app is open */ }
  document.querySelectorAll('[data-dance-lead-out]').forEach(($o) => { $o.textContent = `${ui.danceLead} ms`; });
});

document.addEventListener('change', (e) => {
  const id = e.target.dataset?.plancue;
  if (!id || !ui.planDraft) return;
  ui.planDraft.cues[id] = e.target.value;
  const kid = kidById(ui.planKid);
  if (kid) planModal(kid);
});

// Exposed for debugging in the browser console only.
window.kidQuest = { get state() { return state; }, save, get cloud() { return cloud; } };
