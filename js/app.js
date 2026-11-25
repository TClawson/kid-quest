import {
  DAY_NAMES, defaultTasks, dateKey, addDays, parseKey, newId, entryFor,
  tasksForDay, snapshotToday, dayStatus, weeklyRewardInfo, rewardsToGive, markRewardGiven, storeOpen, storeLockText, streakInfo, totalXp, totalCoins, levelFor, taskCoins,
  defaultReward, parseReward, MAX_REWARD, isEvening,
  pendingApprovals, fallbackHash, pianoStreakInfo, kidToday, todayQuests, applyTaskChange, undoTaskChanges,
  isExercise, taskGems, totalGems, exerciseStreakInfo, DEFAULT_GEMS, EXERCISE_DAYS, EXERCISE_KEEP_DAYS,
  defaultAllowance, repairAllowanceStart, allowanceFor, parseAllowance, taskPay, taskSize, SIZES, weekEarnings, recentBonuses,
  DEFAULT_ALLOWANCE, DEFAULT_BONUS_LIMIT, questTasks,
  weekParity, isEveryOtherWeek, onWeek, weekStart,
  withMemo, monthDays, habitInfo, CUES, cueFor, routineCue, routineOf, isPinned, planOrder, planSentence, choreWords, weekLookback,
  todaySummary, familyDay, FAMILY_GOAL, milestoneFor, milestoneFresh,
} from './logic.js';
import { sounds, confetti, setSound } from './fx.js';
import { buddySvg, buddyLine, MOVE_ART, catchFor, ballSvg } from './avatar.js';
import { liveHtml, live, liveStart, partyAll } from './live.js';
import { mapTheme } from './maparts.js';
import { mapParty } from './maplife.js';
import { dailySummaries } from './familygarden.js';
import { bloomData, gardenLine } from './villagebloom.js';
import { openLittle } from './little.js';
import { playsLittle, jarStars, spendStar, earnSticker, newLittle } from './littlerules.js';
import { villageHtml, mountVillages, cameOut, cameOutOfMusic, placeVillagers, villagerName, villageGoal } from './village.js';
import { villageLayout } from './villagemaps.js';
import { houseHtml, mountHouses, cameIn, houseGoal } from './house.js';
import { todayHud, todayListHtml } from './today.js';
import { kidHudHtml, statusHtml, menuHtml } from './hud.js';
import { houseChores, shelfLevel, placeOf, setPlace, setInside, HOUSE_CHORES, HOUSE_SLOTS, houseChoreById, setHouseRole, houseTask, linkRoomChores } from './houserules.js';
import { CHORE_SETS, SET_CHORES, choreSetById, setChanges, applySet, routineOfTask } from './choresets.js';
import { tokenPages, chartRoutines, stickers, defaultStyle, chartSignature, chartOutdated, DAY_ORDER } from './charts.js';
import { chartArt } from './chartart.js';
import { ROUTINES, FREE_SEEDS, planDraft, routineList, moveChore, nudgeChore, flexTasks, dayCheck, toggleDay, growable, growTurns, canGrow, signPlan, signedThisWeek, seedThisWeek } from './planrules.js';
import { musicHouseHtml, mountMusicHouses, cameInMusic } from './musichouse.js';
import { musicTier, daysToMusicHouse, studioOpen, labOpen, deskOpen, tierInfo } from './musicrules.js';
import { spotById, homeLayout, isPlaced, placeFurniture, needsMusicHouse, tankOf, tankRoom } from './furniture.js';
import { houseRecord, openTurntable, spinning, stopRecord, setTurntableSync } from './turntable.js';
import { applyGrants, restoreFromRecord, restoreBackup, restoreTasks, mergeBackup } from './grants.js';
import { furnitureThumb } from './houseart.js';
import { SEEDS, DECOR, KINDS, seedById, decorById, gardenSpotById, gardenLayout, placeDecor, buySeed, seedCount, thirsty, gardenView, gardenOf, plantableTasks, plant, digUp, relink, harvest, setWatered, houseHarvest } from './gardenrules.js';
import { seedThumb, decorThumb } from './gardenart.js';
import { gardenHtml, mountGardens, cameInGarden } from './garden.js';
import { leaderboard, weekOf } from './leaderboard.js';
import { openSkiBook } from './skibook-ui.js';
import { openFindsBook, openFindPage, bookTabs } from './findsbook-ui.js';
import { openFansBook, openFanPage } from './fansbook-ui.js';
import { releaseDay, releaseLabel } from './releases.js';
import { openDigBook, openDinoPage, openTreasurePage, openDisplayPicker, digShow } from './digbook-ui.js';
import { openTrickBook, openTrickPage } from './trickbook-ui.js';
import { bookPages, bookCount, fishSpecies, tankFishes, tankSlots, putInTank, takeFromTank, NICK_MAX, recordLb, recordClass } from './fishbook.js';
import { realFish, fmtWeight, CLASSES, weightRanges } from './fishfacts.js';
import { fishPic } from './fishart.js';
import { startMusic, stopMusic, playShowAudio, muffleMusic } from './music.js';
import { viewSongbook, mountSongbook, songbookActions, openSongbook, printCardHtml } from './songbook.js';
import { viewStudio, mountStudio, studioActions, openStudio } from './studio.js';
import { mountTestRec } from './testrec.js';
import { viewNfc, mountNfcTest } from './nfctest.js';
import { viewLab, mountLab, labActions, openLab } from './notolab.js';
import { viewCompose, mountCompose, composeActions, openCompose } from './composedesk.js';
import { SEASONS, shownSeason, trySeason, seasonOf } from './seasons.js';
import {
  SPECIES, SLOTS, ITEMS, itemById, comingSoon, isUnlocked, needLabel, needGap, pianoDaysNeeded, LEGACY_LEVEL, wandPower, defaultBuddy, restingMood, isWorn, ownedFor, addOwned, fitsSpecies, moveWornToBuddy, switchSpecies,
  SPORTS, MOVES, unlockedMoves, pickMove, moveWeeks, bestGear,
} from './items.js';
import { pickVisitors, visitorLines, milestoneBrag, milestoneCheer, MAX_VISITORS } from './visits.js';
import { GAME_NAMES } from './play.js';
import { openPlay } from './playground.js';
import { openCritterAlbum, openCritterPage } from './albumview.js';
import { SPOTS as FISH_SPOTS, boatThumb } from './fishing.js';
import { PERSONALITIES } from './tagfun.js';
import { chestTier, chestPrize, chestPiece, treasureFound, mapsNeedingPieces, chestReady, prizeText, TROPHIES, PIECES_PER_MAP, tierById, LATE_DAYS } from './treasure.js';
import { chestSvg, trophySvg, mapPiecesSvg, secretSvg, secretSize, SECRETS } from './treasure-art.js';
import { playShow, showPlaying } from './mapshow.js';
import { createStore, migrate, localBackend, stableJson, DEVICE_SETTINGS } from './store.js';
import { state, setState, provide } from './ctx.js';
import {
  startTimer, stopTimer, leaveTimer, returnToTimer, restoreTimer, timerOnScreen, mmss, buddyCheer,
  ears, startEars, stopEars, wakeEars, viewTimer, viewWatch,
  listenTest, viewListen, startListenTest, stopListenTest, setLastListenMood, LISTEN_MODE_KEY, DANCE_LEAD, DANCE_LEAD_KEY,
} from './timer-ui.js';
import {
  pendingRemote, setPendingRemote, loadCloud, onCloudStatus, startCloud, applyRemote,
  familyCard, syncState, familyCreate, familyJoin, familyJoinGo, familyInvite, showCode, familyLeave,
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

let fullWarned = false;
function save() {
  try {
    const { changed, removed, local } = store.save(state);
    // A full device still sends its saves to the family; say so once.
    if (local === false && !fullWarned) {
      fullWarned = true;
      toast('Saved to the family, but this device’s storage is full.');
    }
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
  // device's own sound and music settings, wait for the family's data
  const local = createStore().load();
  for (const k of DEVICE_SETTINGS) if (k in local.settings) state.settings[k] = local.settings[k];
}
setSound(state.settings.sound);

const ui = {
  view: state.settings.pinHash ? 'home' : 'setup',
  autoKid: true, // on start, a device with one kid skips the picker (see render)
  kidId: null,
  taskId: null,
  tab: 'today',
  editKidId: null,
  todayOpen: new Set(), // kids whose card is open on the parents' Today tab
  todayDone: new Set(), // kids whose done chores are shown there
  openTask: null, // the one chore open in Edit kid
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

// action: an optional { label, run } button on the toast, like Undo.
function toast(text, action) {
  document.querySelectorAll('.toast').forEach((t) => t.remove()); // one at a time
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-btn';
    b.textContent = action.label;
    b.addEventListener('click', () => { el.remove(); action.run(); });
    el.append(' ', b);
  }
  document.body.appendChild(el);
  setTimeout(() => el.remove(), action ? 6000 : 2600);
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
  if (pendingRemote && $modal.hidden) { const next = pendingRemote; setPendingRemote(null); applyRemote(next, { fromServer: false }); } // its gotState was settled when it arrived
  // a family update (the visiting buddies, the first word from the server) held back while the
  // pop-up was open: draw the screen again now, so the visitors arrive without waiting for the next change
  if (family.held && $modal.hidden) { family.held = false; if (!timerOnScreen()) render(); }
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

// ---------- Plan my week (planrules.js): routines, days, one thing to grow, sign ----------

const seedPics = new Map();
const seedPic = (id) => {
  if (!seedPics.has(id)) { let u = ''; try { u = seedThumb(document, id)?.toDataURL() || ''; } catch { u = ''; } seedPics.set(id, u); }
  return seedPics.get(id);
};

/** The steps a kid's planner has: the days step only when a parent left some days to them. */
const planSteps = (kid) => ['routines', ...(flexTasks(kid).length ? ['days'] : []), 'grow', 'sign'];

/** "After snack, I'll practice piano, then do chore of the week." */
function routineSentence(kid, d, routine) {
  const list = routineList(kid, d, routine);
  if (!list.length) return '';
  const cue = d.cues[routine];
  const parts = list.map((t) => choreWords(t));
  const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, then ${parts[parts.length - 1]}` : parts[0];
  return `${cue ? `${cue}, I'll` : "I'll"} ${said}.`;
}

function planRoutinesHtml(kid, d) {
  return ROUTINES.map((r) => {
    const list = routineList(kid, d, r.id);
    const rows = list.map((t, i) => {
      const pinned = isPinned(t);
      const moving = ui.planMoving === t.id;
      return `<div class="pl-row ${moving ? 'moving' : ''}" data-plrow="${t.id}">
          <span class="pl-n">${i + 1}</span>
          <span class="pl-name">${esc(t.icon)} ${esc(t.name)}${pinned ? ' <span class="pl-pin" title="Stays in this routine">📌</span>' : ''}</span>
          <span class="pl-btns">
            <button class="btn ghost round" data-action="plan-nudge" data-id="${t.id}" data-dir="-1" ${i ? '' : 'disabled'} aria-label="Earlier">▲</button>
            <button class="btn ghost round" data-action="plan-nudge" data-id="${t.id}" data-dir="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="Later">▼</button>
            ${pinned ? '' : `<button class="btn ghost small-btn" data-action="plan-moving" data-id="${t.id}" aria-expanded="${moving}">Move</button>`}
            <span class="pl-grab" data-drag="${t.id}" aria-hidden="true">⋮⋮</span>
          </span>
          ${moving ? `<span class="pl-moveto">Move to: ${ROUTINES.filter((o) => o.id !== r.id).map((o) => `<button class="btn small-btn" data-action="plan-moveto" data-id="${t.id}" data-routine="${o.id}">${o.icon} ${esc(o.name)}</button>`).join('')}</span>` : ''}
        </div>`;
    }).join('');
    const say = routineSentence(kid, d, r.id);
    return `<section class="pl-routine" data-routine="${r.id}">
        <h3>${r.icon} ${esc(r.name)}</h3>
        <select data-planroutine="${r.id}" aria-label="When ${esc(r.name.toLowerCase())} starts">
          <option value="">When does it start?</option>
          ${CUES[r.id].map((c) => `<option ${c === d.cues[r.id] ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <div class="pl-list" data-droplist="${r.id}">${rows || '<p class="pl-empty muted small">Drag a chore here</p>'}</div>
        ${say ? `<small class="plan-say">“${esc(say)}”</small>` : ''}
      </section>`;
  }).join('');
}

function planDaysHtml(kid, d) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return `<div class="pl-days">
      ${order.map((dow) => `<span class="pl-dh">${DAY_NAMES[dow].slice(0, 2)}</span>`).join('')}
      ${flexTasks(kid).map((t) => {
    const on = new Set(d.days[t.id] || []);
    const c = dayCheck(d, t);
    return `<span class="pl-dl">${esc(t.icon)} ${esc(t.name)} <small class="${c.ok ? 'ok' : ''}">${isExercise(t) ? `${c.picked} ${c.picked === 1 ? 'day' : 'days'} · ${c.need} makes a strong week 💪` : `${c.picked} of ${c.need} ${c.need === 1 ? 'day' : 'days'}`}</small></span>
          ${order.map((dow) => `<button class="pl-d ${on.has(dow) ? 'on' : ''}" data-action="plan-day" data-id="${t.id}" data-dow="${dow}" aria-pressed="${on.has(dow)}" aria-label="${esc(t.name)} on ${DAY_NAMES[dow]}">${on.has(dow) ? '✓' : ''}</button>`).join('')}`;
  }).join('')}
    </div>
    <p class="muted small">Pick ${flexTasks(kid).filter((t) => !isExercise(t)).map((t) => `${t.kidDays} ${t.kidDays === 1 ? 'day' : 'days'} for ${esc(t.name.toLowerCase())}`).join(', ') || 'your exercise days'}. Everything else is on the days Mom or Dad set.</p>`;
}

function planGrowHtml(kid, d) {
  const lb = weekLookback(state, kid, today());
  const rate = new Map(lb.tasks.map((r) => [r.task.id, r]));
  const given = seedThisWeek(kid, today());
  const choices = growable(kid);
  // two chores with one name (morning and night teeth) say which is which
  const twin = (t) => choices.some((o) => o !== t && o.name === t.name);
  const when = { morning: 'morning', afternoon: 'after school', evening: 'night', exercise: 'exercise' };
  return `<div class="pl-grow">${choices.map((t) => {
    const r = rate.get(t.id);
    const name = twin(t) ? `${t.name} (${when[d.routines[t.id] || routineOf(t)]})` : t.name;
    // chores take turns: one that grew a seed waits until the others have had theirs
    if (!canGrow(kid, t.id, today())) return `<button class="pl-pick pl-grown" disabled>${esc(t.icon)} ${esc(name)}<small>${given ? 'Not this week' : '🌼 Grown already'}</small></button>`;
    return `<button class="pl-pick ${d.grow === t.id ? 'on' : ''}" data-action="plan-grow" data-id="${t.id}" aria-pressed="${d.grow === t.id}">${esc(t.icon)} ${esc(name)}${r ? `<small>last week ${r.done} of ${r.of}</small>` : ''}</button>`;
  }).join('')}</div>
    ${!given && (kid.grown || []).length && growTurns(kid).size < choices.length ? `<p class="muted small">🌼 Each chore gets its own week to grow. The ones you've grown wait until every chore has had a turn.</p>` : ''}
    ${given ? `<p class="pl-seed-given">🌱 Your free seed this week: <b>${esc(given.name)}</b></p>` : `
    <h3>🎁 Pick your free seed packet</h3>
    <p class="muted small">It's planted for the chore you grow: it grows a step every day you do it, and blooms in 7 days.</p>
    <div class="pl-seeds">${FREE_SEEDS.map((sd) => `<button class="pl-seed ${d.seed === sd.id ? 'on' : ''}" data-action="plan-seed" data-id="${sd.id}" aria-pressed="${d.seed === sd.id}"><img src="${seedPic(sd.id)}" alt=""><small>${esc(sd.name)}</small></button>`).join('')}</div>`}`;
}

function planSignHtml(kid, d) {
  const grow = (kid.tasks || []).find((t) => t.id === d.grow);
  const seed = seedById(d.seed) || seedThisWeek(kid, today());
  return `<div class="pl-sign">
      ${ROUTINES.map((r) => { const say = routineSentence(kid, d, r.id); return say ? `<p><b>${r.icon} ${esc(r.name)}</b><br>“${esc(say)}”</p>` : ''; }).join('')}
      ${grow ? `<p><b>🌱 This week I'll grow</b><br>${esc(grow.icon)} ${esc(grow.name)}${seed ? ` and my ${esc(seed.name.toLowerCase())}` : ''}</p>` : ''}
    </div>`;
}

function planModal(kid) {
  const d = ui.planDraft;
  const steps = planSteps(kid);
  const step = Math.min(ui.planStep || 0, steps.length - 1);
  const at = steps[step];
  const title = { routines: kid.planWithGrownUp ? '📝 My routines (with a grown-up)' : '📝 My routines', days: '📅 Pick your days', grow: '🌱 This week I\'ll grow…', sign: '✍️ My plan' }[at];
  const help = {
    routines: 'Put your chores in the order you\'ll do them. Drag one to another routine, or tap Move. 📌 ones stay put. Then pick the moment each routine starts.',
    days: 'Some chores are yours to place. Tap the days you\'ll do them.',
    grow: 'Pick one chore to get better at this week. Your buddy will cheer extra for it.',
    sign: 'Read it out loud. Is this your plan?',
  }[at];
  const daysOk = flexTasks(kid).every((t) => dayCheck(d, t).ok);
  const growOk = Boolean(d.grow) && (seedThisWeek(kid, today()) || d.seed);
  const canNext = at === 'days' ? daysOk : at === 'grow' ? growOk : true;
  const body = at === 'routines' ? planRoutinesHtml(kid, d) : at === 'days' ? planDaysHtml(kid, d) : at === 'grow' ? planGrowHtml(kid, d) : planSignHtml(kid, d);
  const html = `
    <div class="plan planner ${kid.planWithGrownUp ? 'pl-big' : ''}" data-step="${at}">
      <div class="pl-step muted small">Step ${step + 1} of ${steps.length}</div>
      <h1>${title}</h1>
      <p class="muted">${help}</p>
      ${body}
      <div class="row end">
        ${step ? `<button class="btn ghost" data-action="plan-step" data-dir="-1">◂ Back</button>` : '<button class="btn ghost" data-action="modal-close">Later</button>'}
        ${at === 'sign' ? `<button class="btn" data-action="plan-sign" data-kid="${kid.id}">I'm in!</button>` : `<button class="btn" data-action="plan-step" data-dir="1" ${canNext ? '' : 'disabled'}>Next ▸</button>`}
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
  ui.planStep = 0;
  ui.planMoving = null;
  ui.planDraft = planDraft(kid, today());
  planModal(kid);
}

// Dragging a chore between routines: grab its ⋮⋮ (or press and hold the row), drop it on
// another chore (it goes before that one) or on a routine's list (it goes last).
let planDrag = null;
function planDragStart(id, e) {
  const row = $modal.querySelector(`[data-plrow="${id}"]`);
  if (!row) return;
  const r = row.getBoundingClientRect();
  const ghost = row.cloneNode(true);
  ghost.classList.add('pl-ghost');
  Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
  document.body.append(ghost);
  row.classList.add('pl-lifted');
  planDrag = { id, ghost, dy: e.clientY - r.top, target: null, at: { clientX: e.clientX, clientY: e.clientY } };
  // near the top or bottom of the planner, it scrolls, so a chore can go to any routine
  planDrag.scroll = setInterval(() => {
    const card = $modal.querySelector('.modal-card');
    if (!planDrag || !card) return;
    const box = card.getBoundingClientRect();
    const y = planDrag.at.clientY;
    const step = y < box.top + 56 ? -10 : y > box.bottom - 56 ? 10 : 0;
    if (step) { card.scrollTop += step; planDragMove(planDrag.at); }
  }, 30);
  try { navigator.vibrate?.(15); } catch { /* not on every device */ }
}
function planDragMove(e) {
  if (!planDrag) return;
  e.preventDefault?.();
  planDrag.at = { clientX: e.clientX, clientY: e.clientY };
  planDrag.ghost.style.top = `${e.clientY - planDrag.dy}px`;
  $modal.querySelectorAll('.pl-over, .pl-over-end').forEach((x) => x.classList.remove('pl-over', 'pl-over-end'));
  planDrag.ghost.hidden = true;
  const under = document.elementFromPoint(e.clientX, e.clientY);
  planDrag.ghost.hidden = false;
  const row = under?.closest?.('[data-plrow]');
  const list = under?.closest?.('.pl-routine')?.querySelector('[data-droplist]');
  if (row && row.dataset.plrow !== planDrag.id) { row.classList.add('pl-over'); planDrag.target = { routine: row.closest('[data-droplist]').dataset.droplist, before: row.dataset.plrow }; } else if (list) { list.classList.add('pl-over-end'); planDrag.target = { routine: list.dataset.droplist, before: null }; } else planDrag.target = null;
}
function planDragEnd() {
  if (!planDrag) return;
  const { id, ghost, target, scroll } = planDrag;
  clearInterval(scroll);
  planDrag = null;
  ghost.remove();
  const kid = kidById(ui.planKid);
  if (kid && ui.planDraft && target) {
    const t = kid.tasks.find((x) => x.id === id);
    if (!moveChore(kid, ui.planDraft, id, target.routine, target.before) && t) toast(`${t.name} stays in its routine 📌`);
  }
  if (kid) { const card = $modal.querySelector('.modal-card'); const top = card?.scrollTop || 0; planModal(kid); if (card) card.scrollTop = top; }
}
let planHold = null;
document.addEventListener('pointerdown', (e) => {
  if (!$modal.querySelector('.planner[data-step="routines"]')) return;
  const grab = e.target.closest?.('[data-drag]');
  if (grab) { e.preventDefault(); planDragStart(grab.dataset.drag, e); return; }
  const row = e.target.closest?.('[data-plrow]');
  if (!row || e.target.closest('button, select')) return;
  const at = [e.clientX, e.clientY];
  planHold = { at, timer: setTimeout(() => { planHold = null; planDragStart(row.dataset.plrow, e); }, 350) };
});
document.addEventListener('pointermove', (e) => {
  if (planHold && Math.hypot(e.clientX - planHold.at[0], e.clientY - planHold.at[1]) > 8) { clearTimeout(planHold.timer); planHold = null; }
  planDragMove(e);
}, { passive: false });
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { if (planHold) { clearTimeout(planHold.timer); planHold = null; } planDragEnd(); });

// ---------- printed charts from the kid's plan (charts.js, chartart.js) ----------
// A full-page view over the app with the kid's pages, scaled to the screen; Print sends just
// the pages to the printer (or a PDF), at their real size: Letter, landscape.

function chartPicture(art, c) {
  const pic = { bed: art.bedPic, dressed: art.dressPic, teeth: art.teethPic, 'teeth-night': art.teethNightPic, clothes: art.clothesPic, toys: art.toysPic, books: art.booksPic }[c.kind];
  if (pic) return `<img src="${pic}" alt="">`;
  // a chore with no drawing yet: its icon, big, on its color, with the buddy cheering in the corner
  return `<div class="cp-generic" style="--c:${c.color}"><span class="cp-emoji">${esc(c.icon)}</span><img class="cp-face" src="${art.facePic}" alt=""></div>`;
}
const chartIcon = (art, c) => {
  const pic = { bed: art.bedIcon, dressed: art.shirtIcon, teeth: art.brushIcon, 'teeth-night': art.brushIcon, clothes: art.hamperIcon, toys: art.blocksIcon, books: art.booksIcon }[c.kind];
  return pic ? `<img src="${pic}" alt="">` : `<span class="cp-ico">${esc(c.icon)}</span>`;
};

function tokenPageHtml(kid, art, p) {
  const title = `${p.title}, ${kid.name}!`;
  const titlePic = p.routine === 'morning' ? art.sleepPic : art.humPic;
  const corner = p.routine === 'evening' ? art.moonIcon : p.routine === 'morning' ? art.sunIcon : art.noteIcon;
  return `<section class="cp-page cp-tokens" style="--n:${p.chores.length}">
    <div class="cp-top">
      <img class="cp-tpic" src="${titlePic}" alt="">
      <div class="cp-tt"><h1 style="font-size:${Math.min(0.78, 7.2 / ((title.length + 2) * 0.32)).toFixed(3)}in">${esc(title)}${p.parts > 1 ? ` <small>${p.part} of ${p.parts}</small>` : ''}</h1><div class="cp-sub"${p.sentence.length > 80 ? ' style="font-size:0.22in;line-height:0.25in"' : ''}>${esc(p.sentence)}</div></div>
      <img class="cp-corner" src="${corner}" alt="">
    </div>
    <div class="cp-cols">
      ${p.chores.map((c) => `<div class="cp-col" style="--c:${c.color}">
        <div class="cp-frame">${chartPicture(art, c)}<span class="cp-num">${c.n}</span>${c.grow ? '<span class="cp-grow">🌱 Growing!</span>' : ''}</div>
        <div class="cp-label">${chartIcon(art, c)}<span>${esc(c.name)}</span></div>
        ${c.daysText ? `<div class="cp-days">${esc(c.daysText)}</div>` : ''}
        <div class="cp-spot"><img src="${art.starIcon}" alt=""></div>
      </div>`).join('')}
      <div class="cp-col cp-fin">
        <div class="cp-frame"><img src="${art.finPic}" alt=""><div class="cp-yay">All done!</div></div>
        <div class="cp-feed">
          <div class="cp-cap">With each token:</div>
          <div class="cp-ln"><b>1</b>Tap to start</div>
          <div class="cp-ln"><b>2</b>Do it together</div>
          <div class="cp-ln"><b>3</b>Tap again!</div>
        </div>
      </div>
    </div>
    <div class="cp-night"><img src="${art.moonIcon}" alt=""><span>At bedtime, tokens go back on the stars.</span><span class="cp-sp"></span>${p.chores.map((c) => `<span class="cp-mini" style="--c:${c.color}">${chartIcon(art, c)}</span>`).join('')}<img src="${art.starIcon}" alt=""><span>Goodnight!</span></div>
    <div class="cp-foot"><span>Kid Quest · made from ${esc(kid.name)}'s plan</span><span>Week of ${esc(shortDate(weekStart(today())))}</span></div>
  </section>`;
}

/** Row height (inches) that fits every chore of the week grid on one page. */
const rowHeight = (groups) => Math.min(0.42, 6.1 / (groups.reduce((n, g) => n + g.chores.length, 0) + groups.length * 1.3 + 1));
function gridPageHtml(kid, art) {
  const groups = chartRoutines(kid);
  const name = { morning: '☀️ Morning', afternoon: '🎒 After school', evening: '🌙 Evening', exercise: '💪 Exercise' };
  return `<section class="cp-page cp-grid">
    <div class="cp-top">
      <img class="cp-tpic" src="${art.finPic}" alt="">
      <div class="cp-tt"><h1>${esc(kid.name)}'s week</h1><div class="cp-sub">My plan, my way. Tick each box when it's done.</div></div>
    </div>
    <table class="cp-table" style="--rh:${rowHeight(groups).toFixed(3)}in">
      <thead><tr><th></th>${DAY_ORDER.map((d) => `<th>${DAY_NAMES[d]}</th>`).join('')}</tr></thead>
      ${groups.map((g) => `<tbody>
        <tr class="cp-gh"><th colspan="8"><div>${name[g.routine]}${g.sentence ? ` <small>“${esc(g.sentence)}”</small>` : ''}</div></th></tr>
        ${g.chores.map((c, i) => `<tr><td class="cp-rn">${g.routine === 'exercise' ? '' : `${i + 1}. `}${esc(c.icon)} ${esc(c.name)}${c.grow ? ' 🌱' : ''}</td>${DAY_ORDER.map((d) => `<td>${c.days.includes(d) ? '<i class="cp-box"></i>' : '<span class="cp-off">·</span>'}</td>`).join('')}</tr>`).join('')}
      </tbody>`).join('')}
    </table>
    <div class="cp-foot"><span>Kid Quest · made from ${esc(kid.name)}'s plan${kid.plan?.grow ? ' · 🌱 the chore I\'m growing this week' : ''}</span><span>Week of ${esc(shortDate(weekStart(today())))}</span></div>
  </section>`;
}

function stickerPageHtml(kid, art) {
  const list = stickers(kid);
  if (!list.length) return '';
  return `<section class="cp-page cp-stickers">
    <h2>Token stickers for ${esc(kid.name)}</h2>
    <p class="cp-cut">Print on full-sheet sticker paper, cut out each 2-inch circle and stick it on a token. Each token belongs to one page of the chart.</p>
    <div class="cp-stk">${list.map((c) => `<div class="cp-sticker" style="--c:${c.color}">${chartIcon(art, c)}<small>${esc(c.name)}${c.kind === 'teeth-night' ? ' 🌙' : ''}</small></div>`).join('')}<div class="cp-sticker" style="--c:#3b2235"><img src="${art.facePic}" alt=""><small>${esc(kid.name)}</small></div></div>
  </section>`;
}

function chartsHtml(kid) {
  const art = chartArt(kid.buddy);
  const style = ui.chartStyle || defaultStyle(kid);
  const pages = style === 'grid' ? gridPageHtml(kid, art) : tokenPages(kid).map((p) => tokenPageHtml(kid, art, p)).join('') + (ui.chartStickers ? stickerPageHtml(kid, art) : '');
  return `<div class="cp-bar">
      <b>🖨️ ${esc(kid.name)}'s chart</b>
      <span class="cp-seg"><button class="${style === 'tokens' ? 'on' : ''}" data-action="chart-style" data-style="tokens">Token pages</button><button class="${style === 'grid' ? 'on' : ''}" data-action="chart-style" data-style="grid">Week grid</button></span>
      ${style === 'tokens' ? `<label><input type="checkbox" data-chartstickers ${ui.chartStickers ? 'checked' : ''}> Token stickers</label>` : ''}
      <span class="cp-sp"></span>
      <button class="btn" data-action="chart-print">Print</button>
      <button class="btn ghost" data-action="chart-close">Close</button>
    </div>
    ${kid.plan?.signed ? '' : `<p class="cp-note">${esc(kid.name)} hasn't made a plan yet, so this is the chores as you set them. It changes once they plan their week.</p>`}
    <div class="cp-pages">${pages}</div>`;
}

let chartView = null;
function openCharts(kid) {
  closeModal();
  ui.chartKid = kid.id;
  ui.chartStyle = null;
  chartView ||= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'chart-view' }));
  chartView.hidden = false;
  document.documentElement.classList.add('charts-open');
  drawCharts();
}
function drawCharts() {
  const kid = kidById(ui.chartKid);
  if (!kid || !chartView) return;
  chartView.innerHTML = chartsHtml(kid);
  fitCharts();
}
/** Fits the 11-inch pages to the screen (printing uses their real size). Never redraws: printing resizes the window. */
function fitCharts() {
  if (!chartView) return;
  const k = Math.min(1, (window.innerWidth - 24) / (11 * 96));
  chartView.style.setProperty('--k', k.toFixed(3));
}
function closeCharts() {
  ui.chartKid = null;
  if (chartView) { chartView.hidden = true; chartView.innerHTML = ''; }
  document.documentElement.classList.remove('charts-open');
}
window.addEventListener('afterprint', () => {
  const kid = ui.chartKid && kidById(ui.chartKid);
  if (!kid) return;
  kid.chartPrinted = chartSignature(kid);
  delete kid.chartWanted;
  save();
});
window.addEventListener('resize', () => { if (ui.chartKid) fitCharts(); });

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
/** A short line for an opened chest: its prize, plus the map piece that came with it. */
const chestTitle = (prize) => prizeText(prize, mapName).title + (prize.piece && prize.kind !== 'piece' ? ' And a map piece!' : '');
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
  // a treasure map piece comes as well as the prize (silver and gold chests)
  const piece = chestPiece(prize);
  if (piece) {
    const n = after.pieces[piece] || 0;
    extra = `
        <div class="prize-piece">
          <h2>And a treasure map piece!</h2>
          <div class="prize-art">${mapPiecesSvg(n, PIECES_PER_MAP, { scale: 5, ground: mapGround(piece) })}</div>
          ${n >= PIECES_PER_MAP
    ? `<p class="prize-big">You finished the ${esc(mapName(piece))} treasure map! Something secret is waiting in that village now. 👀</p>`
    : `<p class="muted">It's part of the ${esc(mapName(piece))} map: ${n} of ${PIECES_PER_MAP} pieces.</p>`}
        </div>`;
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
  setTimeout(() => { sounds.day(); confetti(piece || prize.kind === 'trophy' ? 160 : 90, 2200); }, 1000);
}

/** The trophy shelf and the treasure maps (in the Status pop-up and from the shelf in the house). */
function trophiesHtml(kid) {
  const found = treasureFound(state.log, kid.id);
  const maps = unlockedMaps(kid);
  const shelf = TROPHIES.map((t) => {
    const has = found.trophies.has(t.id);
    return `<div class="trophy ${has ? '' : 'missing'}">${trophySvg(t.id, { scale: 3, locked: !has })}<small>${has ? esc(t.name) : '?'}</small></div>`;
  }).join('');
  const mapShelf = [...found.maps].map((m) => `<div class="trophy">${trophySvg(`map-${m}`, { scale: 3, ground: mapGround(m) })}<small>${esc(mapName(m))} map</small></div>`).join('');
  const mapRows = maps.map((m) => {
    const n = found.pieces[m] || 0;
    return `<div class="treasure-map-row">${mapPiecesSvg(n, PIECES_PER_MAP, { scale: 3, ground: mapGround(m) })}<div><b>${esc(mapName(m))}</b><small>${n >= PIECES_PER_MAP ? 'Finished! Find the secret in its village.' : `${n} of ${PIECES_PER_MAP} pieces`}</small></div></div>`;
  }).join('');
  return `
      <p class="muted small">Trophies come from treasure chests. ${found.trophies.size} of ${TROPHIES.length} found.</p>
      <div class="trophy-shelf">${shelf}${mapShelf}</div>
      <h3>🗺️ Treasure maps</h3>
      <p class="muted small">Silver and gold chests sometimes hold a piece of a treasure map. Finish one to find a secret in that place's village.</p>
      <div class="treasure-maps">${mapRows}</div>`;
}

/** The trophy shelf and the treasure maps, on their own (from the shelf in the house). */
function openTrophies(kid) {
  openModal(`
    <div class="trophy-room">
      <h2>🏆 ${esc(kid.name)}'s trophies</h2>
      ${trophiesHtml(kid)}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
}

// ---------- task actions ----------

// Returns what undoTaskChanges needs to put it back (a parent's tick, approval or send-back).
function setTask(kid, key, task, value) {
  const change = applyTaskChange(state, kid.id, key, task.id, value);
  save();
  return change;
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
    stopRecord();
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
  // A family device with no saved copy (new, or its copy couldn't be read) waits for the
  // family instead: setting up here would send a new PIN and new kids over the family's.
  if (cloudCfg) {
    const stuck = cloud.signedOut || cloud.error;
    return `
    <div class="screen center setup">
      <div class="logo">⭐</div>
      ${waitingForFamily('This device belongs to a family. Its data will appear as soon as it arrives.')}
      ${stuck ? `<p class="muted small">${cloud.signedOut ? 'This device was signed out of the family.' : `Sync problem: ${esc(cloud.error)}`}</p>
      <button class="btn ghost" data-action="family-leave">Stop syncing on this device</button>` : ''}
    </div>`;
  }
  return `
    <div class="screen center setup">
      <div class="logo">⭐</div>
      <h1>Welcome to Kid Quest</h1>
      <p>Daily quests for chores and piano, with streaks and celebrations.</p>
      <p class="muted">First, choose a 4-digit parent PIN. Kids will need a parent to type it to sign off chores and change settings.</p>
      <button class="btn huge" data-action="setup-pin">Choose parent PIN</button>
      <p class="muted small">Already set up Kid Quest on another device?</p>
      <button class="btn ghost" data-action="family-join">Join your family with a code</button>
    </div>`;
}

function viewHome() {
  // a parent's phone also says how many of each kid's chores wait for a parent
  const waiting = parentDevice() ? pendingApprovals(state, today()) : [];
  const cards = state.kids.map((kid) => {
    const { s, info } = kidSummary(kid);
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 100;
    const wait = waiting.filter((w) => w.kid.id === kid.id).length;
    return `
      <button class="kid-card" data-action="open-kid" data-id="${kid.id}" style="--kid:${kid.color}">
        ${buddyHtml(kid, moodFor(kid), 'md', { live: true })}
        <div class="kid-name">${esc(kid.name)}</div>
        <div class="streak ${info.streak ? '' : 'cold'}">🔥 ${info.streak} <small class="best" title="Best streak">🏆 ${info.best}</small></div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div class="muted">${s.complete ? 'Quest complete! 🌟' : `${s.done} of ${s.total} done`}${wait ? ` · <b class="kid-wait">${wait} waiting</b>` : ''}</div>
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
        <button class="btn ghost" data-action="parent">${parentDevice() ? '👪' : '🔒'} Parents${parentBadge() ? ` <span class="badge">${parentBadge()}</span>` : ''}</button>
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

// Everyone in the family who has a buddy: this device's kids plus, on a kid's
// device, the others from the cloud.
function familyBuddies() {
  const all = new Map((family.buddies || []).map((b) => [b.id, b]));
  for (const k of state.kids) all.set(k.id, { id: k.id, name: k.name, color: k.color, buddy: k.buddy, owned: k.owned || [], exBest: mover(k).exBest, today: todaySummary(state, k, today()), milestone: k.milestone || null, playBest: k.playBest || {}, gameBests: k.gameBests || null });
  return [...all.values()];
}

/**
 * Everyone in the family with what the village garden needs (id, daily, today, startDate, tasks):
 * this device's kids in full, and on a kid's device the others from the cloud.
 */
function gardenKids() {
  // a buddy cached by an older version has no tasks: nothing of theirs is counted then
  const all = new Map((family.buddies || []).map((b) => [b.id, b.tasks ? b : { ...b, tasks: [] }]));
  for (const k of state.kids) all.set(k.id, k);
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
    // each day's chores done, for the family's village garden (the other devices can't load this kid's days)
    const daily = dailySummaries(state, k, today());
    if (daily) { k.daily = daily; changed = true; }
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
  if (ui.view !== 'kid') return;
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

/** "Family: 8 of 10 chores done today" while there is more than one kid (where: what celebrates). */
function familyText(where) {
  const all = familyBuddies();
  if (all.length < 2) return null;
  const f = familyDay(all, today());
  const goal = Math.round(FAMILY_GOAL * 100);
  const text = f.happy
    ? `🎉 Family party! Everyone's done ${Math.round(f.share * 100)}% of today's chores`
    : f.unknown
      ? `👨‍👩‍👧‍👦 Family: ${f.done} chores done so far · when everyone gets to ${goal}%, the whole ${where} celebrates`
      : `👨‍👩‍👧‍👦 Family: ${f.done} of ${f.total} chores done · at ${goal}% the whole ${where} celebrates`;
  return { f, text };
}

/** Why the village is growing (or thirsty): one small, warm line, in the Status pop-up. */
function gardenBanner() {
  const line = gardenLine(gardenKids(), today());
  return line ? `<p class="garden-line ${line.wilted ? 'wilted' : ''}">${line.icon} ${esc(line.text)}</p>` : '';
}

// The family party: every buddy on the map gets a silly happy face and dances,
// and the map's critters bounce along, for a few seconds each time the map opens.
const PARTY_MS = 5000;
let partyDue = false;
let partyDay = null; // the day the family party already started by itself on this screen
function maybeParty() {
  if (ui.view !== 'kid') return;
  const happy = familyToday().happy;
  // when the family crosses the goal while the map is open, celebrate right then too
  const justNow = happy && partyDay !== today();
  if (!(happy && (partyDue || justNow))) { partyDue = false; return; }
  partyDue = false;
  partyDay = today();
  startParty();
}
function startParty() {
  const keys = [...$app.querySelectorAll('.village canvas.live-buddy')].map((c) => c.dataset.live);
  partyAll(keys, PARTY_MS);
  mapParty(PARTY_MS);
  $app.querySelectorAll('.village').forEach((el) => el.classList.add('party'));
  setTimeout(() => $app.querySelectorAll('.village').forEach((el) => el.classList.remove('party')), PARTY_MS);
}

// How a visiting buddy feels on the map: content, focused while fishing, and
// bouncing to play once the host's quest is done.
function visitFeel(area, complete) {
  if (area?.kind === 'pond') return { valence: 0.6, arousal: 0.45, focus: 0.3 };
  if (complete) return { valence: 0.9, arousal: 0.85 };
  if (area) return { valence: 0.8, arousal: 0.65 };
  return { valence: 0.6, arousal: 0.55 };
}

/** Today's visitors, what each one says, and who has news (for the village green). */
function visitorInfo(kid, s) {
  const visitors = todaysVisitors(kid);
  if (!visitors.length) return { visitors, lines: [], news: {} };
  const lines = visitorLines(visitors, { name: kid.name, streak: streakInfo(state, kid, today()).streak, complete: s.complete }, today());
  // once the quest is done, every visitor wants to play (see playWith)
  if (s.complete) {
    const left = gamesLeftFor(kid);
    const invite = { soccer: 'Keepy-uppy? Tap me!', hockey: 'Hockey? Tap me!', football: 'Wanna throw the football? Tap me!', fishing: 'Wanna go fishing? Tap me!', sledding: 'Sledding? Tap me!', race: 'Race me down the hill? Tap me!', train: 'Wanna ride the photo train? Tap me!', tricks: 'Trick jumps on our bikes? Tap me!', dig: 'Dino dig? Tap me!', tag: 'Wanna play tag? Tap me!' };
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

/** The map theme follows the kid's Places background. */
const kidTheme = (kid) => kid.buddy?.outfit?.background || 'bg-meadow';
/** The dino dig's stand and pedestal (and the dig book) show once a kid has a shovel or a find. */
const hasDig = (kid) => Boolean(bestGear(kid.owned || []).shovel || Object.keys(kid.digBones || {}).length || Object.keys(kid.digTreasures || {}).length);
/** A show can play again a minute after the last one. */
const SHOW_AGAIN_MS = 60000;

/** A chore as a quest in the village (and its talk box): its state, its line and its plan step. */
function questItem(kid, t, status, st, step = 0, first = true) {
  let sub = st === 'done' ? 'Done!' : st === 'pending' ? 'Waiting for a parent' : t.verify === 'parent' ? 'A parent checks this one' : 'Tap "I did it" when it\'s done';
  if (st !== 'done' && st !== 'pending' && t.minutes > 0) {
    const sec = status?.seconds || 0;
    const left = t.minutes * 60 - sec;
    sub = left <= 0 ? 'Time done! Get a parent' : sec ? `${mmss(left)} left on the timer` : `${t.minutes} minute timer`;
  }
  // bonus exercise says what it earns
  if (isExercise(t) && st !== 'done' && taskGems(t)) sub += ` · earns ${taskGems(t)} 💎`;
  // with a cue for the whole routine, its first chore says the cue and the rest say "Then"
  const cue = !first && routineCue(kid, t) ? 'Then' : cueFor(kid, t);
  return { id: t.id, name: t.name, icon: t.icon, period: t.period, st, sub, verify: t.verify, timer: t.minutes > 0, step, plan: cue ? planSentence(cue, t) : '' };
}

/** Today's quests as the village gives them: mornings first, each half in the kid's planned order; the first one to do is 'current'. */
function questList(kid, s, entry) {
  const tasks = ['morning', 'afternoon'].flatMap((period) => planOrder(kid, s.tasks.filter((x) => x.period === period)));
  let current = false;
  // a kid who made their own plan sees its steps numbered, and the village follows them
  const planned = Boolean(kid.plan?.order?.length);
  const seen = new Set();
  return tasks.map((t, i) => {
    const status = entry?.tasks?.[t.id];
    let st = status?.status === 'done' ? 'done' : status?.status === 'pending' ? 'pending' : 'todo';
    if (st === 'todo' && !current) { st = 'current'; current = true; }
    const first = !seen.has(routineOf(t));
    seen.add(routineOf(t));
    return questItem(kid, t, status, st, planned ? i + 1 : 0, first);
  });
}

/** Today's bonus exercise, as the coach gives it (never 'current': it's a bonus, not the next quest). */
function coachQuests(kid, entry) {
  const t = today();
  return planOrder(kid, tasksForDay(state, kid, t, t).filter(isExercise)).map((x) => {
    const status = entry?.tasks?.[x.id];
    return questItem(kid, x, status, status?.status === 'done' ? 'done' : status?.status === 'pending' ? 'pending' : 'todo');
  });
}

/** The ids of today's chores done in the kid's house (every bedroom and bathroom chore), which villagers don't give out. */
function houseQuestIds(kid) {
  return new Set(houseChores(state, kid, today()).ids);
}

/** The house chores the house is showing right now (the night teeth only once it's their turn). */
function houseNowIds(kid) {
  const hc = houseChores(state, kid, today());
  return new Set(HOUSE_SLOTS.map((k) => hc[k]?.id).filter(Boolean));
}

// The village: the kid's chores, as quests from villagers (see village.js).
function villageView(kid, s, entry, mood) {
  const list = questList(kid, s, entry);
  const planned = Boolean(kid.plan?.order?.length);
  // the buddy's house: where the day starts, and wherever the kid left the buddy after that
  // (its house, the music house, or out in the village)
  const place = placeOf(kid.id, today());
  if (place === 'house') return houseView(kid, list, mood);
  if (place === 'garden') return gardenScreen(kid, list, mood);
  const prog = progressFor(kid);
  const tier = musicTier(prog);
  if (place === 'music' && tier) return musicView(kid, list, mood, tier);
  // chores linked to the house (the kid's bedroom and bathroom) are done in the house, not given out by
  // villagers; the house door shows what's still waiting in there
  // (the evening ones too, before it's their turn: pajamas and the night teeth wait in there)
  const inHouse = houseQuestIds(kid);
  const houseNow = houseNowIds(kid);
  const homeOpen = list.filter((q) => houseNow.has(q.id) && (q.st === 'todo' || q.st === 'current'));
  const homeNext = homeOpen.find((q) => q.st === 'current') || homeOpen[0];
  const home = homeOpen.length ? { left: homeOpen.length, icon: homeNext.icon, task: homeNext.name, step: homeNext.step, now: homeOpen.some((q) => q.st === 'current') } : null;
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
    shop: { open: store.open, left: store.left || 0, evening: store.evening, missed: store.missed },
    kidId: kid.id,
    kidName: kid.name,
    kidColor: /^#[0-9a-f]{6}$/i.test(kid.color || '') ? kid.color : '#e03131',
    buddy: buddyHtml(kid, mood, 'mini', { background: false, live: true, idle: true }),
    tasks: list.filter((q) => !inHouse.has(q.id)),
    home,
    planned,
    chest: { html: chestSvg(c.tier.id, Boolean(c.opened), 1), ready: c.ready, opened: Boolean(c.opened) },
    music: { tier, left: tier ? 0 : daysToMusicHouse(prog) },
    little: playsLittle(kid) ? { stars: jarStars(state, kid, today()) } : null,
    garden: { thirsty: gardenThirsty(kid) },
    bloom: bloomData(gardenKids(), today()),
    today: today(),
    coach: coachFor(kid, entry),
    hud: kidHud(kid),
  });
}

/** The coach's quests (bonus exercise) and how the kid's strong weeks are going, or null with no exercise today. */
function coachFor(kid, entry) {
  const tasks = coachQuests(kid, entry);
  return tasks.length ? { tasks, line: exWeekText(exerciseInfo(kid)) } : null;
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
    lab: labOpen(state, kid, today()),
    desk: deskOpen(state, kid, today()),
    hello: musicHello(kid.id, tier),
    quests: list.filter((q) => q.st === 'todo' || q.st === 'current').length,
    hud: kidHud(kid),
  });
}

const musicHandlers = {
  onPiano: () => { ui.view = 'watch'; ui.watchSession = 0; ui.watchNote = ''; render(); },
  onSheets: () => openSongbook(),
  onStudio: () => openStudio(),
  onLab: () => openLab(),
  onDesk: () => openCompose(),
  onExit: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setPlace(kid.id, today(), 'out');
    cameOutOfMusic(kid.id, kidTheme(kid));
    render();
  },
  sound: () => sounds.tap(),
};
/** Inside the buddy's house (house.js): today's bedroom and bathroom chores, the trophy shelf, the furniture. */
function houseView(kid, list, mood) {
  const t = today();
  const hc = houseChores(state, kid, t);
  const inHouse = new Set(hc.ids);
  const chores = {};
  for (const k of HOUSE_SLOTS) {
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
    // the door sign counts what's waiting outside (the house's own chores are in here)
    quests: list.filter((q) => (q.st === 'todo' || q.st === 'current') && !inHouse.has(q.id)).length,
    tank: tankFishes(kid, tankRoom(kid)),
    fish: bookCount(kid.fishRecords).caught,
    garden: { thirsty: gardenThirsty(kid) },
    harvest: houseHarvest(state, kid, t),
    hud: kidHud(kid),
    little: playsLittle(kid),
    dig: hasDig(kid) ? digShow(kid) : null,
  });
}

const houseHandlers = {
  onTask: (id, el) => onTaskTap(id, el),
  onTrophies: () => actions.trophies(),
  onLeaderboard: () => openLeaderboard(kidById(ui.kidId)),
  onTank: () => openTankPicker(kidById(ui.kidId)),
  onFishBook: () => openFishBook(kidById(ui.kidId)),
  onTurntable: () => openTurntable(ui.kidId),
  onStand: () => openDisplayPicker(kidById(ui.kidId), 'stand'),
  onPedestal: () => openDisplayPicker(kidById(ui.kidId), 'pedestal'),
  onPuzzle: () => openLittleGames('puzzle'),
  spinning: (kidId) => spinning(kidId),
  onGarden: () => goGarden('house'),
  onExit: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setInside(kid.id, today(), false);
    cameOut(kid.id, kidTheme(kid));
    render();
  },
  sound: () => sounds.tap(),
};

// ---------- the garden behind the house (garden.js, rules in gardenrules.js) ----------

/** How many plants are waiting for water: their chore is done today and they haven't been watered. */
function gardenThirsty(kid) {
  const g = gardenOf(kid);
  if (![...g.beds, ...g.trees].some(Boolean)) return 0;
  const t = today();
  return thirsty(gardenView(state, kid, t), kid.id, t).length;
}

/** The buddy walks through to the garden (from the village or from inside the house). */
function goGarden(from) {
  const kid = kidById(ui.kidId);
  if (!kid) return;
  setPlace(kid.id, today(), 'garden');
  cameInGarden(kid.id, from);
  render();
}

function gardenScreen(kid, list, mood) {
  const t = today();
  const view = gardenView(state, kid, t);
  return gardenHtml({
    kidId: kid.id,
    kidName: kid.name,
    color: /^#[0-9a-f]{6}$/i.test(kid.color || '') ? kid.color : '#e03131',
    buddy: buddyHtml(kid, mood, 'mini', { background: false, live: true, idle: true }),
    view,
    thirsty: thirsty(view, kid.id, t),
    tasks: plantableTasks(kid).map((x) => ({ id: x.id, name: x.name, icon: x.icon })),
    seeds: gardenOf(kid).seeds,
    theme: kidTheme(kid),
    today: t,
    hud: kidHud(kid),
  });
}

const gardenHandlers = {
  onPlant: (where, index, seedId, taskId) => {
    const kid = kidById(ui.kidId);
    const err = kid ? plant(kid, where, index, seedId, taskId, today()) : 'No kid.';
    if (!err) { sounds.task(); save(); }
    return err;
  },
  onDig: (where, index) => {
    const kid = kidById(ui.kidId);
    if (kid && digUp(kid, where, index)) save();
  },
  onRelink: (where, index, taskId) => {
    const kid = kidById(ui.kidId);
    if (kid && relink(state, kid, where, index, taskId, today())) save();
  },
  onHarvest: (index, how) => {
    const kid = kidById(ui.kidId);
    const r = kid ? harvest(state, kid, index, how, today()) : 'No kid.';
    if (typeof r !== 'string') { sounds.day(); save(); }
    return r;
  },
  onWatered: (ids) => { const kid = kidById(ui.kidId); if (kid) setWatered(kid.id, today(), ids); },
  onShop: () => { ui.slot = 'garden'; actions.wardrobe(); },
  onHouse: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setInside(kid.id, today(), true);
    cameIn(kid.id);
    render();
  },
  onVillage: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setPlace(kid.id, today(), 'out');
    cameOut(kid.id, kidTheme(kid));
    render();
  },
  refresh: () => render(),
  sound: () => sounds.tap(),
};

// ---------- the fish book and the fish tank (in the house) ----------
// The kid's biggest catch of every kind of fish (kid.fishRecords, kept by the fishing game),
// and the ones they picked and named for their tank (kid.tank). See fishbook.js. A bigger tank
// from the shop's Home tab (furniture.js) holds more of them.

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

function openFishBook(kid, scrollTo = 0) {
  if (!kid) return;
  const recs = kid.fishRecords || {};
  const { caught, total } = bookCount(recs);
  const inTank = new Set(tankSlots(kid).slice(0, tankRoom(kid)).map((f) => f.species));
  const pages = bookPages(recs, kidTheme(kid)).map((page) => {
    const n = page.fish.filter((f) => f.record).length;
    return `
      <div class="fb-map">
        <h3>🎣 ${esc(page.name)} <small>${n} of ${page.fish.length}</small></h3>
        <div class="fb-grid ${n ? '' : 'mini'}">
          ${page.fish.map((f) => (f.record ? `
            <button class="fb-fish ${f.rare ? 'rare' : ''}" data-action="fish-page" data-species="${esc(f.id)}">
              ${inTank.has(f.id) ? '<span class="fb-tank" title="In your tank">🐟</span>' : ''}
              <img src="${fishImg(f.id)}" alt="">
              <b>${esc(f.name)}</b>
              <span class="fb-size">${fishBadge(f.id, f.record)}${fmtWeight(recordLb(f.id, f.record))}</span>
              <small>${esc(fishDate(f.record.date))}</small>
            </button>` : `
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
      ${bookTabs('fish')}
      <h2>📖 ${esc(kid.name)}'s fish book</h2>
      <p class="muted small fb-count">${caught ? `${caught} of ${total} kinds of fish caught. Each one shows the biggest yet: ${Object.values(CLASSES).map((c) => `${c.icon} ${lower(c.name)}`).join(', ')}. Tap a fish to learn about it!` : `No fish yet! Go fishing with a visiting buddy: every kind you catch goes in here (${total} to find).`}</p>
      ${pages}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
  if (scrollTo) { const card = $modal.querySelector('.modal-card'); if (card) card.scrollTop = scrollTo; }
}

/** A small / typical / trophy badge for a record. */
function fishBadge(id, record) {
  const c = CLASSES[recordClass(id, record)];
  return c ? `<span class="fb-badge" title="${c.name}" aria-label="${c.name}">${c.icon}</span>` : '';
}

/**
 * One fish's page in the fish book: the kid's biggest, what's small, typical and a trophy for
 * that kind of fish (a scale with the kid's catch on it), and true facts about it (fishfacts.js).
 * A pretend fish teaches about its real cousin.
 */
function openFishPage(kid, id) {
  const sp = fishSpecies(id);
  const rec = kid?.fishRecords?.[id];
  const real = realFish(id);
  if (!sp || !rec || !real) return;
  const lb = recordLb(id, rec);
  const cls = recordClass(id, rec);
  const c = CLASSES[cls];
  const r = weightRanges(id);
  // the scale: smallest to biggest on a log scale, the three classes colored, the kid's fish marked
  const [w0, w1, , w3, w4] = r.w;
  const pos = (w) => Math.max(0, Math.min(100, (100 * Math.log(w / w0)) / Math.log(w4 / w0)));
  const a = pos(w1); const b = pos(w3);
  const facts = [['🗺️ Where it lives', real.where], ['🍽️ What it eats', real.eats], ['🤩 Wow!', real.wow]];
  openModal(`
    <div class="fishpage" style="--kid:${esc(kid.color)}">
      <button class="btn ghost small-btn fp-back" data-action="fish-book-back">◀ Fish book</button>
      <div class="fp-head ${sp.rare ? 'rare' : ''}">
        <img src="${fishImg(id)}" alt="">
        <div>
          <h2>${sp.rare ? '⭐ ' : ''}${esc(sp.name)}</h2>
          <p class="muted small">${esc(sp.mapName)}</p>
        </div>
      </div>
      <div class="fp-mine" style="--cls:${c?.color || '#868e96'}">
        <span class="fp-badge">${c?.icon || ''}</span>
        <div><b>Your biggest: ${fmtWeight(lb)}</b><small>${c ? `${c.name}${cls === 'trophy' ? '! Wow!' : ''}` : ''} · ${esc(fishDate(rec.date))}</small></div>
      </div>
      ${real.pretend ? `<p class="fp-pretend">✨ The ${esc(sp.name.toLowerCase())} is a pretend fish: it lives only in this game. Its real-life cousin is the <b>${esc(real.name)}</b>, so its weights and facts here are the real cousin's.</p>` : ''}
      <h3>⚖️ How big do they get?</h3>
      <p class="fp-typical">A typical one weighs about <b>${r.typical}</b>.</p>
      <div class="fp-scale" role="img" aria-label="Small is under ${r.small}, trophy is ${r.trophy} or more, yours is ${fmtWeight(lb)}">
        <div class="fp-bar">
          <span class="s" style="width:${a}%"></span><span class="t" style="width:${b - a}%"></span><span class="x" style="width:${100 - b}%"></span>
        </div>
        <span class="fp-pin" style="left:${pos(Math.max(w0, Math.min(w4, lb)))}%">▼</span>
      </div>
      <ul class="fp-classes">
        <li><span>${CLASSES.small.icon}</span> <b>Small</b> under ${r.small}</li>
        <li><span>${CLASSES.typical.icon}</span> <b>Typical</b> ${r.small} to ${r.trophy}</li>
        <li><span>${CLASSES.trophy.icon}</span> <b>Trophy</b> ${r.trophy} or more</li>
      </ul>
      ${real.biggest && !real.pretend ? `<p class="muted small">🥇 Biggest ever caught on a rod: ${esc(real.biggest)}.</p>` : ''}
      ${facts.map(([h, t]) => `<h3>${h}</h3><p>${esc(t)}</p>`).join('')}
      <button class="btn" data-action="fish-book-back">Back to the fish book</button>
    </div>`);
}

/**
 * The tank's fish picker: a row of the tank's places (as many as the tank holds), then the kid's
 * caught fish to put in the one picked, and a name for it. slot: which place to start on (the
 * first empty one when not given).
 */
function openTankPicker(kid, slot = null) {
  if (!kid) return;
  const recs = kid.fishRecords || {};
  const tank = tankOf(kid);
  const room = tankRoom(kid);
  const mine = bookPages(recs, kidTheme(kid)).flatMap((p) => p.fish.filter((f) => f.record).map((f) => ({ ...f, mapName: p.name })));
  if (!mine.length) {
    openModal(`
      <div class="tankpick">
        <h2>🐟 Your ${esc(lower(tank.name))}</h2>
        <p>The tank is empty! Go fishing with a visiting buddy. Every fish you catch goes in your fish book, and then you can pick ${room > 1 ? `up to ${room}` : 'one'} to live here and give ${room > 1 ? 'them names' : 'it a name'}.</p>
        <button class="btn" data-action="modal-close">OK!</button>
      </div>`);
    return;
  }
  const shown = tankFishes(kid, room);
  const kept = tankSlots(kid);
  // a place holds the fish kept there if it still shows (a fish gone from the book counts as empty)
  const at = (i) => (kept[i] && shown.find((f) => f.species === kept[i].species)) || null;
  const firstEmpty = Array.from({ length: room }, (_, i) => i).find((i) => !at(i));
  const pick = Math.max(0, Math.min(room - 1, slot ?? firstEmpty ?? 0));
  // a place past the fish there now adds one at the end
  ui.tankSlot = Math.min(pick, kept.length);
  const now = at(pick);
  const others = new Set(kept.filter((_, i) => i !== ui.tankSlot).map((f) => f.species));
  ui.tankPick = now?.species || mine.find((f) => !others.has(f.id))?.id || null;
  const places = room > 1 ? `
      <div class="tp-slots" role="tablist" aria-label="Places in the tank">
        ${Array.from({ length: room }, (_, i) => {
    const f = at(i);
    return `<button class="tp-slot ${i === pick ? 'on' : ''} ${f ? '' : 'empty'}" data-action="tank-slot" data-slot="${i}" role="tab" aria-selected="${i === pick}">
            ${f ? `<img src="${fishImg(f.species)}" alt=""><b>${esc(f.nickname)}</b>` : `<span class="tp-plus">+</span><b>Empty</b>`}
          </button>`;
  }).join('')}
      </div>` : '';
  openModal(`
    <div class="tankpick" style="--kid:${esc(kid.color)}">
      <h2>🐟 Your ${esc(lower(tank.name))}</h2>
      <p class="muted small">${room > 1 ? `It holds ${room} fish. Tap a place, then pick a fish from your fish book to swim there.` : 'Pick a fish from your fish book to swim in your tank.'}</p>
      ${places}
      <div class="tp-grid">
        ${mine.map((f) => {
    const taken = others.has(f.id);
    return `<button class="tp-fish ${f.id === ui.tankPick ? 'on' : ''} ${taken ? 'taken' : ''}" data-action="tank-pick" data-species="${esc(f.id)}" aria-pressed="${f.id === ui.tankPick}" ${taken ? 'disabled' : ''}>
            <img src="${fishImg(f.id)}" alt="">
            <b>${f.rare ? '⭐ ' : ''}${esc(f.name)}</b>
            <small>${taken ? 'In the tank' : `${fmtWeight(recordLb(f.id, f.record))} · ${esc(f.mapName)}`}</small>
          </button>`;
  }).join('')}
      </div>
      <label class="tp-name">Give it a name
        <input id="tank-name" type="text" maxlength="${NICK_MAX}" autocomplete="off" spellcheck="false" placeholder="${esc(fishSpecies(ui.tankPick)?.name || '')}" value="${esc(now?.nickname && now.nickname !== now.name ? now.nickname : '')}">
      </label>
      <div class="tp-buttons">
        <button class="btn" data-action="tank-save" ${ui.tankPick ? '' : 'disabled'}>Put it in the tank</button>
        ${now ? `<button class="btn ghost" data-action="tank-empty">${room > 1 ? 'Take it out' : 'Empty the tank'}</button>` : ''}
        <button class="btn ghost" data-action="modal-close">${room > 1 && shown.length ? 'Done' : 'Cancel'}</button>
      </div>
      ${room < 5 ? `<p class="muted small tp-more">Want more fish? Bigger tanks are in the shop, under House.</p>` : ''}
    </div>`);
}
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

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

/** Today's visitors for the village green: who comes, what they say, their games and gear. */
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
  // the village's camera may still be settling: a show that hangs on the landmark can ask where it is now
  const spotNow = () => { const q = el.getBoundingClientRect(); const lq = layer.getBoundingClientRect(); return { x: q.left + q.width / 2 - lq.left, y: q.top + q.height / 2 - lq.top }; };
  const def = playShow(layer, theme, { buddy: img, scale, spot: { x: r.left + r.width / 2 - lr.left, y: r.top + r.height / 2 - lr.top }, spotNow, onDone: () => layer.closest('.village')?.classList.remove('show-on') });
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
  onGarden: () => goGarden('out'),
  onMusic: () => {
    const kid = kidById(ui.kidId);
    if (!kid) return;
    setPlace(kid.id, today(), 'music');
    cameInMusic(kid.id);
    render();
  },
  onBakery: () => openLittleGames('bakery'),
  onBuddy: (el) => actions['buddy-move'](el),
  sound: (name) => (name === 'talk' ? sounds.tap() : sounds.tap()),
};

// ---------- the little games (little.js, rules in littlerules.js) ----------
// Little Bakery (its door in the village) and Animal Puzzles (the puzzle box in the buddy's room),
// for a kid a parent turned "Little games" on for. Each chore they finish drops a star in their
// jar (on top of its coins); one star is one visit of three rounds.

// How many stars each kid's jar showed last time, on this device, so new ones fly in.
const LITTLE_SEEN_KEY = 'kidquest.littleSeen';
function littleSeen(kidId, n) {
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(LITTLE_SEEN_KEY) || '{}') || {}; } catch { seen = {}; }
  if (n === undefined) return seen[kidId];
  seen[kidId] = n;
  try { localStorage.setItem(LITTLE_SEEN_KEY, JSON.stringify(seen)); } catch { /* the stars just fly in again */ }
  return n;
}

function openLittleGames(start) {
  const id = ui.kidId;
  const kid = kidById(id);
  if (!kid || !playsLittle(kid)) return;
  const stars = () => { const k = kidById(id); return k ? jarStars(state, k, today()) : 0; };
  const now = stars();
  const seen = littleSeen(id);
  littleSeen(id, now);
  openLittle({
    kid,
    theme: kidTheme(kid),
    start,
    buddy: buddySvg(dressed(kid), 'happy', { background: false }),
    sound: state.settings.sound !== false,
    newStars: seen === undefined ? 0 : Math.max(0, now - seen),
    stars,
    spend: () => {
      const k = kidById(id);
      if (!k || !spendStar(state, k, today())) return false;
      save();
      littleSeen(id, stars());
      return true;
    },
    stickers: () => kidById(id)?.little?.stickers || {},
    puzzles: () => kidById(id)?.little?.puzzles || 0,
    onRound: ({ kind, animal, gold }) => {
      const k = kidById(id);
      if (!k?.little) return;
      earnSticker(k, animal, gold);
      if (kind === 'puzzle') k.little.puzzles = (k.little.puzzles || 0) + 1;
      save();
    },
    onClose: () => { littleSeen(id, stars()); render(); },
  });
}

// ---------- the kid's Today button and Today's quests (markup in today.js) ----------
// In the corner of the village (and the house, the garden and the music house): how many of
// today's quests are left, and a list of all of them. The list is walk only: Go walks the buddy
// to whoever gives the quest (into the house for the bed, teeth and floor, to the coach for
// exercise) and the usual talk box takes it from there.

/**
 * The HUD over the full-screen village, house, garden and music house (hud.js): the buddy plate,
 * the family's progress, streak, coins and gems, the Menu, the Today button (and the chest button
 * beside it while an earlier day's chest is waiting) and the Shop.
 */
function kidHud(kid) {
  const t = today();
  const d = kidToday(state, kid, t, 0);
  const late = lateChest(kid);
  const prog = progressFor(kid);
  const fam = familyBuddies().length > 1 ? familyToday() : null;
  const hasGems = tasksForDay(state, kid, t, t).some(isExercise) || kid.gemsSpent || prog.gems;
  return kidHudHtml({
    name: kid.name,
    face: buddySvg(dressed(kid), moodFor(kid), { background: true }),
    level: prog.level,
    into: prog.into,
    streak: prog.streak,
    coins: prog.coins,
    gems: hasGems ? prog.gems : null,
    family: fam ? { happy: fam.happy, done: fam.done, total: fam.total, unknown: fam.unknown, pct: Math.min(100, Math.round((fam.share / FAMILY_GOAL) * 100)) } : null,
    shop: { open: storeOpen(state, kid, t).open, fresh: (kid.newItems || []).length > 0 },
    today: todayHud({
      ...d,
      waiting: d.waitingToday,
      chest: late ? { key: late.key, html: chestSvg(late.tier.id, false, 2), when: late.key === addDays(t, -1) ? 'yesterday' : 'an earlier day' } : null,
    }),
  });
}

/** Who gives each of today's chores: a villager's name, "In your house", or the coach. */
function questGivers(kid) {
  const t = today();
  const s = dayStatus(state, kid, t, t);
  const inHouse = houseQuestIds(kid);
  const out = new Map([...inHouse].map((id) => [id, 'In your house']));
  const list = questList(kid, s, entryFor(state, kid.id, t)).filter((q) => !inHouse.has(q.id));
  for (const p of placeVillagers(list, villageLayout(kidTheme(kid)))) for (const q of p.tasks) out.set(q.id, villagerName(p.kind));
  for (const x of tasksForDay(state, kid, t, t).filter(isExercise)) out.set(x.id, villagerName('coach'));
  return out;
}

/** Why the shop is shut, in a few words (storeOpen's rules, the evening-chores one too). */
function shopLine(lock) {
  const n = (k, what) => `${k} ${what}${k === 1 ? '' : 's'}`;
  if (lock.open) return '👕 The shop is open';
  if (lock.left) return `🔒 Shop opens after ${n(lock.left, lock.evening ? 'more day quest' : 'more quest')}${lock.missed.length ? ' (evening ones count today)' : ''}`;
  return `🔒 Shop opens when a parent checks ${lock.waiting === 1 ? 'your quest' : `${lock.waiting} quests`}`;
}

/** Everything the Today list shows (todayQuests in logic.js, in words). */
function todayModel(kid) {
  const t = today();
  const q = todayQuests(state, kid, t);
  const givers = questGivers(kid);
  const lock = storeOpen(state, kid, t);
  const ex = exerciseInfo(kid);
  const sub = (it) => {
    const x = it.task;
    if (it.state === 'done') return givers.get(x.id) || '';
    if (it.state === 'waiting') return 'Waiting for a parent';
    const parts = [];
    if (it.next) parts.push('Next up');
    if (it.cue) parts.push(it.cue);
    if (it.secondsLeft !== null) parts.push(it.secondsLeft <= 0 ? 'time done! Get a parent' : it.record?.seconds ? `${mmss(it.secondsLeft)} left on the timer` : `${x.minutes} minute timer`);
    if (givers.get(x.id)) parts.push(givers.get(x.id));
    if (x.verify === 'parent' && !(x.minutes > 0)) parts.push('a parent checks this one');
    if (isExercise(x) && taskGems(x)) parts.push(`earns ${taskGems(x)} 💎`);
    const line = parts.join(' · ');
    return line.charAt(0).toUpperCase() + line.slice(1);
  };
  const rows = (list) => list.map((it) => ({
    id: it.task.id, icon: it.task.icon, name: it.task.name, star: it.mastered, sub: sub(it), state: it.state, next: it.next,
    action: it.state === 'todo' ? 'go' : it.state === 'waiting' ? 'ask' : '',
  }));
  const inHouse = houseQuestIds(kid);
  const g = q.groups;
  const groups = [
    { id: 'morning', icon: '🌅', name: 'Morning', note: `by ${formatTime(state.settings.morningBy)}${g.morning.length && g.morning.every((it) => inHouse.has(it.task.id)) ? ' · in your house' : ''}`, list: g.morning },
    { id: 'afternoon', icon: '☀️', name: 'After school', note: `by ${formatTime(state.settings.bedtime)}`, list: g.afternoon },
    { id: 'evening', icon: '🌙', name: 'Evening', note: lock.missed.length ? 'counts for the shop today (one was missed last night)' : "doesn't keep the shop shut", list: g.evening },
    { id: 'exercise', icon: '💪', name: 'Bonus exercise', note: ex.goal ? `${ex.thisWeek} of ${ex.goal} days this week` : 'an excused week', list: g.exercise },
  ].filter((x) => x.list.length).map(({ list, ...x }) => ({ ...x, rows: rows(list) }));
  const c = chestFor(kid, t);
  const tier = `<b>${esc(c.tier.name.toLowerCase())}</b>`;
  const chest = c.opened ? `🎁 Today's chest: ${esc(chestTitle(c.opened))}`
    : c.ready ? `🎁 Today's ${tier} is ready! Open it`
      : !q.total ? '🎁 No quests today' : q.toGo ? `🎁 ${q.toGo} more for today's ${tier}` : `🎁 A parent checks ${q.waitingToday === 1 ? 'one quest' : `${q.waitingToday} quests`}, then today's ${tier}`;
  const day = parseKey(t).toLocaleDateString(undefined, { weekday: 'long' });
  return {
    kidId: kid.id,
    head: `${day} · ${q.excused ? 'day off' : `${q.done} of ${q.total} done`}${q.waitingToday ? ` · ${q.waitingToday} waiting for a parent` : ''}`,
    groups,
    chest: { text: chest, ready: c.ready },
    shop: { open: lock.open, text: shopLine(lock) },
  };
}

function openToday(kid) {
  if (!kid) return;
  openModal(todayListHtml(todayModel(kid)));
  $modal.querySelector('.modal-card')?.classList.add('today-card');
}

// ---------- the Status and Menu pop-ups (markup in hud.js) ----------
// Everything the old kid page showed around the village: the buddy and what it says, streak,
// freezes, coins and gems, the week, the Friday reward, the month, piano and exercise streaks,
// the habits and the trophies; and the Menu's music, sounds, plan, switch kid, Parents.

const daysText = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Status, Me: the big live buddy, the numbers, and how the week is going. */
function statusMe(kid) {
  const t = today();
  const prog = progressFor(kid);
  const info = streakInfo(state, kid, t);
  const mood = moodFor(kid);
  const shop = storeOpen(state, kid, t);
  const exTasks = kid.tasks.some(isExercise);
  const tile = (icon, n, what) => `<div class="s-tile"><b><span aria-hidden="true">${icon}</span> ${n}</b><small>${what}</small></div>`;
  const lines = [
    prog.pianoPerWeek ? `🎹 Piano streak <b>${daysText(prog.piano)}</b> (best ${prog.pianoBest})` : '',
    exTasks || prog.ex.weeks ? `💪 ${esc(exWeekText(prog.ex))}` : '',
  ].filter(Boolean);
  const fam = familyText('village');
  return `
      <div class="s-me">
        <div class="s-left">
          <button class="s-big buddy-tap" data-action="buddy-move" data-kid="${kid.id}" aria-label="Tap ${esc(kid.name)}'s buddy">${buddyHtml(kid, mood, 'xl', { live: true, idle: true })}</button>
          <button class="btn ghost s-outfit" data-action="status-outfit">👕 Change outfit${shop.open ? '' : ' 🔒'}</button>
        </div>
        <div class="s-main">
          <p class="s-say"><span>${esc(buddyLine(mood, kid.name))}</span></p>
          <div class="s-tiles">
            ${tile('🔥', info.streak, `day streak · best ${info.best}`)}
            ${tile('❄️', info.freezes, info.freezes === 1 ? 'streak freeze' : 'streak freezes')}
            ${tile('🪙', prog.coins, 'coins to spend')}
            ${tile('💎', prog.gems, 'gems to spend')}
          </div>
          ${weekCoinsHtml(kid)}
          <h3 class="s-h">This week</h3>
          ${weekDots(kid, info)}
          ${rewardLine(kid)}
          ${lines.length ? `<p class="s-line">${lines.join(' · ')}</p>` : ''}
          ${fam ? `<p class="s-line s-fam">${esc(fam.text)}</p>` : ''}
          ${gardenBanner()}
        </div>
      </div>`;
}

/** Status, This week: streaks, the week's days, the reward, the month, coins and exercise. */
function statusWeek(kid) {
  const info = streakInfo(state, kid, today());
  const w = weekEarnings(state, kid, today());
  const ex = exerciseInfo(kid);
  return `
      ${streakLine(kid, info)}
      ${weekDots(kid, info)}
      ${rewardLine(kid)}
      ${monthLine(kid)}
      ${weekCoinsHtml(kid)}
      ${w.allowance ? `<p class="muted small">Doing every chore this week earns all ${w.allowance.coins} 🪙. Each chore pays its share.</p>` : ''}
      ${kid.tasks.some(isExercise) || ex.weeks ? `<h3 class="s-h">💪 Bonus exercise <small class="muted">earns 💎 gems from Coach Dash</small></h3>${exWeekHtml(ex)}` : ''}
      <p class="muted small">Finish 7 days in a row to earn a streak freeze ❄️ (you can save up to 2). A freeze protects your streak if you miss a day. Miss a day without one and you lose a quarter of your streak (at least 1 day), not all of it, and finishing the next day earns a welcome-back bonus.</p>`;
}

/** Status, Habits: the Habits section, or what it will show once there are habits. */
function statusHabits(kid) {
  return habitsSection(kid) || `
      <section class="habits">
        <h2>⭐ Habits</h2>
        <button class="btn ghost plan-btn" data-action="plan" data-kid="${kid.id}">📝 Plan my week</button>
        <p class="muted">A chore becomes a habit once it has come up for a while. Do it on most days for 60 days to earn a star!</p>
      </section>`;
}

const STATUS_BODIES = { me: statusMe, week: statusWeek, habits: statusHabits, trophies: trophiesHtml };

function openStatus(kid, tab = 'me') {
  if (!kid) return;
  ui.statusTab = STATUS_BODIES[tab] ? tab : 'me';
  const lv = levelFor(totalXp(state, kid, today()));
  const html = statusHtml({ kidId: kid.id, name: kid.name, sub: `Level ${lv.level} · ${100 - lv.into} XP to level ${lv.level + 1}`, tab: ui.statusTab, tricks: Boolean(kid.trickBook || bestGear(kid.owned || []).bike), body: withMemo(() => STATUS_BODIES[ui.statusTab](kid)) });
  // already open: change the tab in place, so it doesn't pop in again
  const open = !$modal.hidden && $modal.querySelector('.modal-card > .status-pop');
  if (open) open.outerHTML = html;
  else {
    openModal(html);
    $modal.querySelector('.modal-card')?.classList.add('status-card');
  }
  // Me has the live buddy (the same one as in the village): it blinks and looks about while the
  // pop-up is open, and goes with it when it closes (live.js only draws canvases on the page)
  liveStart();
}

function openMenu(kid) {
  if (!kid) return;
  const html = menuHtml({
    kidId: kid.id,
    music: state.settings.music !== false,
    sound: Boolean(state.settings.sound),
    kids: state.kids.length,
    parents: { open: parentDevice(), waiting: parentBadge() },
  });
  const open = !$modal.hidden && $modal.querySelector('.modal-card > .menu-pop');
  if (open) { open.outerHTML = html; return; }
  openModal(html);
  $modal.querySelector('.modal-card')?.classList.add('menu-card');
}

/**
 * Go, from the Today list: closes it and walks the buddy to whoever gives the quest, the talk
 * box opening on arrival. A house chore walks in at the door; from indoors the buddy comes out
 * (or goes in) first.
 */
function goQuest(kid, id) {
  closeModal();
  const t = today();
  if (!kid || !taskById(kid, t, id)) return;
  const hc = houseChores(state, kid, t);
  // an evening chore waits at its place too (the night teeth at the sink), even before it's its turn
  const task = taskById(kid, t, id);
  const kind = HOUSE_SLOTS.find((k) => hc[k]?.id === id) || (hc.ids.includes(id) ? houseChoreById(task.house)?.slot || null : null);
  const place = placeOf(kid.id, t);
  const where = place === 'house' || place === 'garden' ? place : place === 'music' && musicTier(progressFor(kid)) ? 'music' : 'out';
  if (kind) {
    if (where === 'house') { $app.querySelector('.house:not(.music-house)')?.goChore?.(kind); return; }
    houseGoal(kid.id, kind);
    const village = where === 'out' && $app.querySelector('.village');
    if (village?.goHome) { village.goHome(); return; }
    setInside(kid.id, t, true);
    cameIn(kid.id);
    render();
    return;
  }
  if (where === 'out' && $app.querySelector('.village')?.goTask?.(id)) return;
  villageGoal(kid.id, { task: id });
  setPlace(kid.id, t, 'out');
  if (where === 'music') cameOutOfMusic(kid.id, kidTheme(kid)); else cameOut(kid.id, kidTheme(kid));
  render();
}

/** How the strong weeks are going, in one line for the coach to say. */
function exWeekText(ex) {
  const left = (n) => `${n} more ${n === 1 ? 'day' : 'days'}`;
  if (!ex.goal) return `This week is excused: your ${weeksLabel(ex.weeks)} wait for you. 🛡️`;
  if (ex.status === 'strong') return `⭐ Strong week! You have ${weeksLabel(ex.weeks)}.`;
  if (!ex.weeks) return `${left(ex.goal - ex.thisWeek)} of exercise this week makes a ⭐ strong week.`;
  if (ex.status === 'safe') return `🛡️ Your ${weeksLabel(ex.weeks)} are safe. ${left(ex.goal - ex.thisWeek)} adds a ⭐.`;
  return `${left(ex.keep - ex.thisWeek)} keeps your ${weeksLabel(ex.weeks)} safe 🛡️, and ${left(ex.goal - ex.thisWeek)} adds a ⭐.`;
}

/**
 * The kid's screen: the village (or wherever the buddy is: the house, the garden, the music
 * house), full screen, with the HUD over it. Everything that used to be on the page around it
 * is in the Status and Menu pop-ups.
 */
function viewKid() {
  const kid = kidById(ui.kidId);
  if (!kid) { ui.view = 'home'; return viewHome(); }
  const t = today();
  const { s } = kidSummary(kid);
  return `
    <div class="screen kid kid-full" style="--kid:${kid.color}">
      ${villageView(kid, s, entryFor(state, kid.id, t), moodFor(kid))}
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
        <button class="btn ghost plan-btn" data-action="plan" data-kid="${kid.id}">📝 Plan my week</button>
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

const weeksLabel = (n) => `${n} strong ${n === 1 ? 'week' : 'weeks'}`;

/**
 * This week's exercise days as boxes: the box that keeps the strong-week count
 * safe shows a 🛡️ and the box that makes a strong week shows a ⭐, so kids see
 * the rule (3 days keeps it, 4 days adds one) without reading it.
 */
function exWeekHtml(ex) {
  if (!ex.goal) return `<div class="ex-week"><small>🛡️ Excused week: your ${esc(weeksLabel(ex.weeks))} wait for you</small></div>`;
  const dots = Array.from({ length: ex.goal }, (_, i) => {
    const on = i < ex.thisWeek;
    const mark = i === ex.goal - 1 ? ['star', '⭐'] : i === ex.keep - 1 ? ['shield', '🛡️'] : null;
    return `<span class="ex-dot ${on ? 'on' : ''} ${mark ? mark[0] : ''}">${on ? (mark ? mark[1] : '💪') : mark ? mark[1] : ''}</span>`;
  }).join('');
  const left = (n) => `${n} more ${n === 1 ? 'day' : 'days'}`;
  let text;
  if (ex.status === 'strong') text = `<b>⭐ Strong week!</b> You have ${esc(weeksLabel(ex.weeks))}`;
  else if (!ex.weeks) text = `${left(ex.goal - ex.thisWeek)} for a ⭐ strong week`;
  else if (ex.status === 'safe') text = `<b>🛡️ Your ${esc(weeksLabel(ex.weeks))} are safe.</b> ${left(ex.goal - ex.thisWeek)} adds a ⭐`;
  else text = `${left(ex.keep - ex.thisWeek)} keeps your ${esc(weeksLabel(ex.weeks))} safe 🛡️ · ${left(ex.goal - ex.thisWeek)} adds a ⭐`;
  return `<div class="ex-week"><div class="ex-dots" aria-label="${ex.thisWeek} exercise days this week: ${ex.keep} keeps your strong weeks, ${ex.goal} adds one">${dots}</div><small>${text}</small></div>`;
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
        <div class="kid-title"><b>👕 Shop</b><small>Streak ${prog.streak} days · best ${prog.best}${prog.pianoPerWeek ? ` · 🎹 Piano streak ${prog.piano} days (best ${prog.pianoBest})` : ''}</small></div>
      </header>
      <div class="wardrobe-top">
        <button class="buddy-tap" data-action="buddy-move" data-kid="${kid.id}" aria-label="Tap ${esc(kid.name)}'s buddy">${buddyHtml(kid, 'happy', 'lg', { live: true, feel: { valence: 0.8, arousal: 0.6 } })}</button>
        <div class="buddy-side">
          ${ui.speciesOpen
    ? `<div class="pick species-pick">${SPECIES.map((sp) => `<button class="pick-item species ${kid.buddy.species === sp.id ? 'on' : ''}" data-action="wardrobe-species" data-val="${sp.id}" aria-label="${sp.name}">${buddySvg({ species: sp.id }, 'happy', { background: false })}</button>`).join('')}</div>
          <button class="btn ghost small-btn switch-buddy" data-action="wardrobe-switch">Keep my ${esc(speciesName(kid.buddy.species).toLowerCase())}</button>`
    : `<button class="btn ghost small-btn switch-buddy" data-action="wardrobe-switch">🔁 Switch buddy</button>`}
          ${sportTab ? `<p class="gem-line">💎 <b>${prog.gems}</b> gems to spend</p>
          <p class="muted">💪 <b>${esc(weeksLabel(prog.ex.weeks))}</b> (best ${prog.ex.best})</p>
          ${exWeekHtml(prog.ex)}` : `<p class="coin-line">🪙 <b>${prog.coins}</b> coins to spend</p>
          ${nextItem ? `<p class="muted">Next streak prize: <b>${esc(nextItem.name)}</b> at ${esc(needLabel(nextItem))}</p>` : ''}`}
        </div>
      </div>
      ${shopTabs()}
      <div class="items">
        ${items.map((item) => {
    const open = isUnlocked(item, prog);
    const shut = !open && needsMusicHouse(item) && !musicTier(prog); // sold once the music house opens
    const soon = !open && comingSoon(item);
    const on = item.home ? isPlaced(kid, item) : kid.buddy.outfit[item.slot] === item.id;
    // the wand's picture is lit all the way, to show what it does
    const preview = { ...kid.buddy, wand: 1, outfit: item.slot === 'background' ? { background: item.id } : { background: 'none', [item.slot]: item.id } };
    const wearing = item.home ? (on ? 'In your house' : 'Tap to use') : item.noHold ? 'At the lake' : item.slot === 'sport' ? (on ? 'Holding' : 'Tap to hold') : (on ? 'Wearing' : 'Tap to wear');
    const price = item.gems ? `<span class="price gems ${prog.gems >= item.gems ? 'can' : ''}">💎 ${item.gems}</span>`
      : item.price ? `<span class="price ${prog.coins >= item.price ? 'can' : ''}">🪙 ${item.price}</span>` : '';
    return `<button class="item ${open ? '' : 'locked'} ${item.price || item.gems ? 'shop' : ''} ${item.species ? 'special' : ''} ${on ? 'on' : ''}" data-action="wardrobe-item" data-id="${item.id}">
            ${item.species ? `<span class="special-tag">⭐ ${esc(speciesName(item.species))} only</span>` : ''}
            ${item.home ? `<span class="spot-tag">${spotById(item.spot).icon} ${esc(spotById(item.spot).name)}</span>` : ''}
            <span class="item-art">${item.home ? `<img class="home-thumb" src="${homeThumb(item.id)}" alt="">` : item.noHold ? `<img class="home-thumb" src="${boatThumb()}" alt="">` : buddySvg(preview, 'happy', { background: item.slot === 'background' })}</span>
            <span class="item-name">${esc(item.name)}${fresh.has(item.id) ? ' <span class="badge">new</span>' : ''}</span>
            <small>${open ? wearing : soon ? (releaseDay(item) ? `🔒 Coming ${esc(releaseLabel(releaseDay(item)))}` : '🔒 Coming soon') : shut ? '🔒 Opens with your music house' : price || `🔒 ${esc(needLabel(item))}`}</small>
            ${!open && item.need?.pianoWeeks ? `<small class="piano-need">${Math.min(prog.pianoBest, pianoDaysNeeded(item, prog))} of ${pianoDaysNeeded(item, prog)} piano days</small>` : ''}
          </button>`;
  }).join('')}
      </div>
      ${ui.slot === 'garden' ? gardenShop(kid, prog) : ''}
      ${sportTab ? movesList(kid, prog) : ''}
      ${ui.slot === 'music' ? `<p class="muted small">Do piano every time it's on your list to grow your piano streak (a day off from piano doesn't break it). Your best piano streak is ${prog.pianoBest} days.</p>` : ''}
      ${sportTab ? `<p class="muted small">Only exercise earns 💎 gems, and only gems buy sports gear. Gear works with every buddy. Exercise on 4 days in a week (Monday to Sunday) for a ⭐ strong week. 3 days keeps your strong weeks safe 🛡️ but doesn't add one, and fewer takes one away. 1, 3 and 6 strong weeks unlock new moves for each piece of gear you own, and moves stay yours even if your count goes down. Tap your buddy to see a move. Visiting buddies with a fishing rod go fishing! Better rods see and cast farther, and a fishing boat takes you out to deep water. The farther out you fish, the bigger the fish. Visiting buddies with a sled go sledding down your map's treasure hill: every hill hides its own real treasures for your finds book. Better sleds see farther, pull finds in, and the super sled can jump twice. A camera takes you on the photo train to snap wild animals for your critter album. Better cameras focus faster, hold more film and zoom in on far-off animals. Visiting buddies with a bike do trick jumps: every new trick you land is a card for your trick book, a good bike has pegs for grinding rails, and a super bike can boost in mid-air. Visiting buddies with a shovel go on a 90-second dino dig: dig by cliffs, creeks and rocks for real dinosaur bones and treasures for your dig book, and show off a finished skeleton and a treasure in your house. Better shovels walk faster, see more of the dig site and find more.</p>` : ''}
      ${ui.slot === 'home' ? '<p class="muted small">Every task you finish earns coins to spend on furniture. Furniture goes in your buddy\'s house, and every buddy you have can use it. Each spot holds one thing at a time: tap something you own to put it in, or tap it again to take it out. Walk your buddy in the front door of your house in the village to see it!</p>' : ''}
      ${sportTab || ui.slot === 'home' || ui.slot === 'garden' ? '' : `<p class="muted small">Every task you finish earns coins. Spend them on anything with a 🪙 price. Hats, glasses and extras you buy belong to the buddy wearing them, so a new buddy needs its own. Places and streak prizes work with every buddy. Streak prizes can't be bought: keep your streak going to win them, and they stay yours even if a streak ends. Tap an item again to take it off.</p>`}
    </div>`;
}

// The shop's 9 tabs in 5 kinds, so they fit one row on a tablet: Places, Dress up (hats,
// glasses, extras, magic), Music, Sports, House & garden (furniture, garden). A kind with more
// than one tab shows them in a second row. Each button is still a wardrobe-slot button, so
// what's sold and how a tab opens stay the same.
const SHOP_KINDS = [
  { slots: ['background'] },
  { name: 'Dress up', icon: '👕', slots: ['hat', 'face', 'neck', 'hand'] },
  { slots: ['music'] },
  { slots: ['sport'] },
  { name: 'House & garden', icon: '🏠', slots: ['home', 'garden'] },
];
const slotById = (id) => SLOTS.find((sl) => sl.id === id);

function shopTabs() {
  const kind = SHOP_KINDS.find((k) => k.slots.includes(ui.slot)) || SHOP_KINDS[1];
  const top = SHOP_KINDS.map((k) => {
    const sl = slotById(k.slots[0]);
    const on = k === kind;
    // a kind's button opens its first tab (or stays on the one already open)
    return `<button class="${on ? 'on' : ''}" data-action="wardrobe-slot" data-slot="${on ? ui.slot : sl.id}" aria-pressed="${on}">${k.name ? `${k.icon} ${esc(k.name)}` : `${sl.icon} ${esc(sl.name)}`}</button>`;
  }).join('');
  const sub = kind.slots.length > 1
    ? `<nav class="tabs sub" aria-label="${esc(kind.name)}">${kind.slots.map((id) => { const sl = slotById(id); return `<button class="${ui.slot === id ? 'on' : ''}" data-action="wardrobe-slot" data-slot="${id}">${sl.icon} ${esc(sl.name)}</button>`; }).join('')}</nav>`
    : '';
  return `<div class="shop-tabs"><nav class="tabs kinds" aria-label="The shop">${top}</nav>${sub}</div>`;
}

// ---------- the Garden tab of the shop (seed packets and garden decorations, see gardenrules.js) ----------

const gardenThumbs = new Map();
/** A seed packet's or decoration's picture for the shop, drawn once each (gardenart.js). */
function gardenThumb(kind, id) {
  const key = `${kind}|${id}`;
  if (!gardenThumbs.has(key)) {
    let url = '';
    try { url = (kind === 'seed' ? seedThumb(document, id) : decorThumb(document, id))?.toDataURL() || ''; } catch { url = ''; }
    gardenThumbs.set(key, url);
  }
  return gardenThumbs.get(key);
}

function gardenShop(kid, prog) {
  const layout = gardenLayout(kid);
  const owned = new Set(prog.owned);
  const seedCard = (sd) => {
    const have = seedCount(kid, sd.id);
    const days = KINDS[sd.kind].days;
    return `<button class="item shop garden-seed" data-action="garden-buy" data-kind="seed" data-id="${sd.id}">
            <span class="spot-tag">${sd.icon} ${esc(KINDS[sd.kind].name)}</span>
            <span class="item-art"><img class="home-thumb" src="${gardenThumb('seed', sd.id)}" alt=""></span>
            <span class="item-name">${esc(sd.name)}</span>
            <small>Grows in ${days} days${have ? ` · you have ${have}` : ''}</small>
            <span class="price ${prog.coins >= sd.price ? 'can' : ''}">🪙 ${sd.price}</span>
          </button>`;
  };
  const decorCard = (d) => {
    const mine = !d.price || owned.has(d.id);
    const on = layout[d.spot]?.id === d.id;
    const spot = gardenSpotById(d.spot);
    return `<button class="item ${mine ? '' : 'locked'} ${d.price ? 'shop' : ''} ${on ? 'on' : ''}" data-action="garden-buy" data-kind="decor" data-id="${d.id}">
            <span class="spot-tag">${spot.icon} ${esc(spot.name)}</span>
            <span class="item-art"><img class="home-thumb" src="${gardenThumb('decor', d.id)}" alt=""></span>
            <span class="item-name">${esc(d.name)}</span>
            <small>${mine ? (on ? 'In your garden' : 'Tap to use') : `<span class="price ${prog.coins >= d.price ? 'can' : ''}">🪙 ${d.price}</span>`}</small>
          </button>`;
  };
  return `
      <h2 class="garden-h">🌱 Seed packets</h2>
      <p class="muted small">Buy a packet, then plant it in your garden behind your buddy's house. Each plant grows a little every day you do the chore you pick for it.</p>
      <div class="items">${SEEDS.map(seedCard).join('')}</div>
      <h2 class="garden-h">🪴 Garden things</h2>
      <div class="items">${DECOR.filter((d) => d.price || layout[d.spot]?.id !== d.id || d.price === undefined).map(decorCard).join('')}</div>
      <p class="muted small">Garden things go in your buddy's garden, for every buddy you have. Each spot holds one thing at a time: tap something you own to put it out, or tap it again to take it away. Walk your buddy through the back door of your house to see it!</p>`;
}

function buyGarden(kid, kind, id, prog) {
  const item = kind === 'seed' ? seedById(id) : decorById(id);
  if (!item) return;
  if (!item.price) { toggleDecor(kid, item); return; }
  if (kind === 'decor' && prog.owned.includes(item.id)) { toggleDecor(kid, item); return; }
  if (prog.coins < item.price) {
    sounds.error();
    toast(`${item.price - prog.coins} more coins to go! Finish tasks to earn them.`);
    return;
  }
  const note = kind === 'seed'
    ? `<p class="muted small">${esc(KINDS[item.kind].name)} grow in ${KINDS[item.kind].days} days of doing the chore you pick. You'll plant it in your garden.</p>`
    : `<p class="muted small">It goes in your buddy's garden (${esc(gardenSpotById(item.spot).name.toLowerCase())}), for every buddy you have.</p>`;
  openModal(`
    <div class="celebrate">
      <div class="buddy buddy-xl home-buy"><img class="home-thumb" src="${gardenThumb(kind, item.id)}" alt=""></div>
      <h1>Buy ${esc(kind === 'seed' ? `${item.name} seeds` : item.name)}?</h1>
      <p>It costs <b>🪙 ${item.price}</b>. You'll have ${prog.coins - item.price} coins left.</p>
      ${note}
      <div class="stack">
        <button class="btn huge" data-action="garden-buy-confirm" data-kind="${kind}" data-id="${item.id}">Buy it!</button>
        <button class="btn ghost" data-action="modal-close">Keep saving</button>
      </div>
    </div>`);
}

/** Put a garden thing out in its spot (or take it away if it's there already). */
function toggleDecor(kid, item) {
  const was = gardenLayout(kid)[item.spot]?.id === item.id;
  kid.gardenDecor = placeDecor(kid, item);
  sounds.task(); save(); render();
  const basic = gardenSpotById(item.spot).basic;
  toast(was ? (basic ? `Back to the ${decorById(basic).name.toLowerCase()}` : `${item.name} put away`) : `${item.name} is in your garden! 🌱`);
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
    const need = k.id !== 'body' && !gear[k.id] ? `Get a ${k.name.toLowerCase()} and ${weeksLabel(weeks)}` : weeksLabel(weeks);
    return `<button class="move ${open ? '' : 'locked'}" ${open ? `data-action="try-move" data-move="${m.id}"` : 'data-action="move-locked"'} data-need="${esc(need)}">
          <b>${open ? '' : '🔒 '}${esc(m.name)}</b><small>${open ? 'Tap to see it' : esc(need)}</small></button>`;
  }).join('')}</div>`).join('')}`;
}

// ----- parent area -----

/** Chores to check plus weekly rewards to hand over: the number on the Parents button. */
function parentBadge() {
  const t = today();
  return pendingApprovals(state, t).length + rewardsToGive(state, t).length;
}

/**
 * Weekly rewards earned and not handed over yet, one row each with a Given
 * button. They sit under the strip at the top of Today (see rewardStrip) until
 * a parent taps Given, on any parent's phone.
 */
function rewardReminders(due) {
  const name = esc(state.settings.weeklyReward.trim());
  const thisWeek = weekStart(today());
  return `<section class="reward-remind">
      ${due.map(({ kid, monday }) => `
        <div class="list-row">
          ${buddyChip(kid)}
          <div class="grow"><b>🏆 ${esc(kid.name)} earned ${name}!</b><small class="muted">${monday === thisWeek ? 'Every chore done this week.' : 'Earned last week, not given yet.'} Tap Given once ${esc(kid.name)} has it.</small></div>
          <button class="btn" data-action="reward-given" data-kid="${kid.id}" data-monday="${monday}">✓ Given</button>
        </div>`).join('')}
    </section>`;
}

/** "3 Friday rewards to hand out · Ayden, Esther, Edison · See": one strip that opens the Given rows. */
function rewardStrip() {
  const due = rewardsToGive(state, today());
  if (!due.length) return '';
  const names = [...new Set(due.map((d) => d.kid.name))].join(', ');
  return `<div class="reward-strip">
      <span class="rs-icon" aria-hidden="true">🏆</span>
      <span class="rs-text"><b>${due.length} Friday reward${due.length === 1 ? '' : 's'} to hand out</b><small>${esc(names)}</small></span>
      <button class="btn ghost" data-action="rewards-see" aria-expanded="${Boolean(ui.showRewards)}">${ui.showRewards ? 'Hide' : 'See'}</button>
    </div>
    ${ui.showRewards ? rewardReminders(due) : ''}`;
}

/** A family device still showing its own saved copy: the server's hasn't arrived yet. */
const familyBehind = () => Boolean(cloudCfg) && !cloud.gotState;

function waitingForFamily(why) {
  const off = typeof navigator !== 'undefined' && navigator.onLine === false;
  return `<div class="card waiting-family"><h2>⏳ Getting the family's latest…</h2>
    <p class="muted small">${esc(why)}${off ? ' This device is offline: connect to the internet to continue.' : ''}</p></div>`;
}

/**
 * A phone signed in to the family as a parent opens the parent area without the
 * PIN. The role comes from the family's own records when the device joined
 * (js/cloud.js joinFamily / findFamily), and a kid's device signs in without a
 * Google account, so it can never be 'parent'. Kids' devices and devices not in
 * a family keep the PIN.
 */
const parentDevice = () => cloudCfg?.role === 'parent' && !cloud.signedOut;

const PARENT_TABS = [['today', '☀️', 'Today'], ['kids', '🧒', 'Kids'], ['history', '📅', 'Past days'], ['settings', '⚙️', 'Settings']];

function viewParent() {
  const t = today();
  const waiting = pendingApprovals(state, t);
  if (!PARENT_TABS.some(([id]) => id === ui.tab)) ui.tab = 'today';
  let body = '';
  if (ui.tab === 'kids') body = familyBehind() ? waitingForFamily('Kids and chores open once this phone has the family’s latest copy, so an older list here can’t undo changes made on another phone.') : ui.editKidId ? parentEditKid() : parentKids();
  else if (ui.tab === 'history') body = parentHistory();
  else if (ui.tab === 'settings') body = parentSettings();
  else body = parentToday();
  const title = PARENT_TABS.find(([id]) => id === ui.tab)[2];
  const meta = [parseKey(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }), syncState()].filter(Boolean).join(' · ');
  return `
    <div class="screen parent tab-${ui.tab}">
      <header class="phead">
        <div class="phead-title"><h1>${esc(title)}</h1><small class="muted">${esc(meta)}</small></div>
        <button class="btn ghost" data-action="parent-exit" aria-label="Done: back to the kids">Done</button>
      </header>
      ${body}
      ${ui.tab === 'today' && waiting.length ? approveAllBar(waiting) : ''}
      <nav class="pnav" aria-label="Parents">
        <div class="pnav-in">
          ${PARENT_TABS.map(([id, icon, label]) => `<button class="${ui.tab === id ? 'on' : ''}" data-action="tab" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}><i aria-hidden="true">${icon}</i><span>${label}</span>${id === 'today' && waiting.length ? `<span class="nb" aria-label="${waiting.length} waiting">${waiting.length}</span>` : ''}</button>`).join('')}
        </div>
      </nav>
    </div>`;
}

/** "Approve all 4 · 1 from earlier days", fixed above the navigation. */
function approveAllBar(waiting) {
  const earlier = waiting.filter((w) => w.key !== today()).length;
  return `<div class="approve-bar"><div class="approve-bar-in">
      <button class="btn approve-all" data-action="approve-all"><b>✓ Approve all ${waiting.length}</b>${earlier ? `<small>· ${earlier} from earlier days</small>` : ''}</button>
    </div></div>`;
}

// "7 min in other apps" when some of a timer ran while the kid was in another app.
function awayText(record) {
  const away = record?.away || 0;
  if (!away) return '';
  const min = Math.round(away / 60);
  return `${min || '<1'} min in other apps`;
}

/** "Asked 20 min ago", or the time for anything older than an hour. */
function askedWhen(at) {
  if (!at) return '';
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return 'Asked just now';
  if (min < 60) return `Asked ${min} min ago`;
  return `Asked at ${new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

/** The kid's buddy in a small framed picture, with its background. */
const buddyPic = (kid) => `<span class="kc-pic">${buddySvg(dressed(kid), moodFor(kid))}</span>`;

const periodName = (task) => (isExercise(task) ? 'Bonus exercise' : isEvening(task) ? 'Evening' : task.period === 'afternoon' ? 'After school' : 'Morning');

/** One chore waiting for a parent: when it was asked, timer details, Send back and Approve. */
function waitRow(kid, { key, task, record }) {
  const t = today();
  const bits = [];
  if (key !== t) bits.push(`From <b>${key === addDays(t, -1) ? 'yesterday' : esc(friendlyDate(key))}</b>`);
  if (task.minutes) bits.push(`${task.minutes} min done`);
  const away = awayText(record);
  if (away) bits.push(esc(away));
  if (key === t && !task.minutes && record?.at) bits.push(esc(askedWhen(record.at)));
  if (!bits.length) bits.push('Waiting for a parent');
  const data = `data-kid="${kid.id}" data-key="${key}" data-task="${task.id}"`;
  return `<div class="pr wait">
      <span class="ic" aria-hidden="true">${esc(task.icon)}</span>
      <span class="tx"><b>${esc(task.name)}</b><small>${bits.join(' · ')}</small></span>
      <button class="btn ghost mini" data-action="send-back" ${data} aria-label="Send back ${esc(task.name)}" title="Send back">↩</button>
      <button class="btn go" data-action="approve" ${data}>✓ Approve</button>
    </div>`;
}

/** A chore not done yet today, with a big tick box: one tap marks it done by a parent. */
function todoRow(kid, { task, record }) {
  let sub;
  if (isExercise(task)) sub = `Bonus exercise · earns 💎${task.minutes ? ` · ${task.minutes} min` : ''}`;
  else if (task.minutes) sub = record?.seconds ? `${Math.min(task.minutes, Math.floor(record.seconds / 60))} of ${task.minutes} min on the timer` : `${task.minutes} min timer`;
  else if (task.verify === 'parent') sub = 'Needs a parent check';
  else sub = periodName(task);
  return `<div class="pr">
      <span class="ic" aria-hidden="true">${esc(task.icon)}</span>
      <span class="tx"><b>${esc(task.name)}</b><small>${esc(sub)}</small></span>
      <button class="box" data-action="today-tick" data-kid="${kid.id}" data-task="${task.id}" aria-label="Mark ${esc(task.name)} done for ${esc(kid.name)}"></button>
    </div>`;
}

function doneRow(kid, { task, record }) {
  const by = record?.by === 'parent' ? 'Done · ticked by a parent' : 'Done';
  return `<div class="pr done">
      <span class="ic" aria-hidden="true">${esc(task.icon)}</span>
      <span class="tx"><b>${esc(task.name)}</b><small>${by}</small></span>
      <button class="tick" data-action="today-untick" data-kid="${kid.id}" data-task="${task.id}" aria-label="Un-tick ${esc(task.name)} for ${esc(kid.name)}">✓</button>
    </div>`;
}

/** "4 done · 2 waiting · 3 to go", or "All 7 done 🌟 · chest opened". */
function todayLine(kid, d) {
  const waiting = d.waiting.length ? `<b>${d.waiting.length} waiting</b>` : '';
  if (d.excused) return ['Excused today 💤', waiting].filter(Boolean).join(' · ');
  if (!d.total) return ['No chores today', waiting].filter(Boolean).join(' · ');
  if (d.complete) {
    const chest = entryFor(state, kid.id, today())?.chest ? 'chest opened' : 'chest not opened yet';
    return [`All ${d.total} done 🌟`, waiting, chest].filter(Boolean).join(' · ');
  }
  return [`${d.done} done`, waiting, d.toGo ? `${d.toGo} to go` : ''].filter(Boolean).join(' · ');
}

/** One kid's card on Today: the day at a glance, what waits for a parent, and (opened) every chore left. */
function todayCard(kid) {
  const t = today();
  const d = kidToday(state, kid, t);
  const open = ui.todayOpen.has(kid.id);
  const showDone = ui.todayDone.has(kid.id);
  let inside = '';
  if (open) {
    const w = weekEarnings(state, kid, t);
    inside = `
      ${d.todo.map((x) => todoRow(kid, x)).join('')}
      ${!d.todo.length && !d.waiting.length ? '<p class="kc-note">Nothing left to tick today.</p>' : ''}
      ${d.doneTasks.length ? `<button class="more" data-action="today-show-done" data-kid="${kid.id}" aria-expanded="${showDone}">
        <span class="more-list">✓ ${d.doneTasks.length} done: <span class="more-icons" aria-hidden="true">${d.doneTasks.map((x) => esc(x.task.icon)).join(' ')}</span></span>
        <span class="more-link">${showDone ? 'Hide' : 'Show'}</span></button>` : ''}
      ${showDone ? d.doneTasks.map((x) => doneRow(kid, x)).join('') : ''}
      <div class="kc-actions">
        <button class="btn ghost" data-action="bonus" data-kid="${kid.id}" ${w.bonusLeft ? '' : 'disabled'}>🎁 Bonus</button>
        <button class="btn ghost ${d.excused ? 'on' : ''}" data-action="today-excuse" data-kid="${kid.id}" aria-pressed="${d.excused}">😷 ${d.excused ? 'Excused' : 'Excuse'}</button>
        <button class="btn ghost" data-action="today-chores" data-kid="${kid.id}">✏️ Chores</button>
      </div>`;
  }
  return `
    <section class="kc ${open ? 'open' : ''}" style="--kid:${kid.color}" data-kid="${kid.id}">
      <button class="kc-top" data-action="today-kid" data-kid="${kid.id}" aria-expanded="${open}">
        ${buddyPic(kid)}
        <span class="nm"><b>${esc(kid.name)}</b><small>${todayLine(kid, d)}</small></span>
        <span class="chev" aria-hidden="true">${open ? '▲' : '▼'}</span>
      </button>
      ${d.segments.length ? `<div class="seg" role="img" aria-label="${d.done} of ${d.total} done, ${d.waitingToday} waiting">${d.segments.map((s) => `<i class="${s}"></i>`).join('')}</div>` : ''}
      ${d.waiting.map((x) => waitRow(kid, x)).join('')}
      ${inside}
    </section>`;
}

function parentToday() {
  if (!state.kids.length) return '<div class="empty"><p>No kids yet. Add them in Kids.</p></div>';
  return `
    ${rewardStrip()}
    <div class="today-list">${state.kids.map(todayCard).join('')}</div>`;
}

function parentKids() {
  const t = today();
  const log = state.kids.flatMap((kid) => recentBonuses(state, kid, t)).sort((a, b) => (b.at || 0) - (a.at || 0));
  return `
    <div class="list">
      ${state.kids.map((kid) => {
    const w = weekEarnings(state, kid, t);
    const week = w.allowance ? `🪙 ${w.coins} of ${w.allowance.coins} this week${w.bonus ? ` + ${w.bonus} bonus` : ''}` : `${kid.tasks.length} chores${w.bonus ? ` · ${w.bonus} bonus this week` : ''}`;
    const reward = state.settings.weeklyReward?.trim() && weeklyRewardInfo(state, kid, t).earned
      ? ` · 🏆 earned ${state.settings.weeklyReward.trim()}${kid.rewardsGiven?.[weekStart(t)] ? ' (given)' : ''}` : '';
    return `
        <div class="list-row">
          ${buddyChip(kid)}
          <div class="grow"><b>${esc(kid.name)}</b><small class="muted">${week}${esc(reward)}</small></div>
          <button class="btn ${kid.chartWanted || chartOutdated(kid) ? '' : 'ghost'}" data-action="charts" data-kid="${kid.id}" title="${chartOutdated(kid) ? 'The plan changed since the chart was printed' : 'Print chart'}">🖨️${kid.chartWanted || chartOutdated(kid) ? ' New chart' : ''}</button>
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

// This week's share of the allowance for a chore, from the setup as it is now: { coins, xp } or null when it isn't on this week.
function payAverage(kid, task) {
  const days = [];
  const monday = weekStart(today());
  for (let i = 0; i < 7; i += 1) days.push(addDays(monday, i));
  const on = days.filter((d) => task.days.includes(parseKey(d).getDay()) && onWeek(task, d));
  if (!on.length) return null;
  const pays = on.map((d) => taskPay(state, kid, d, task, d));
  const avg = (f) => Math.round(pays.reduce((n, p) => n + p[f], 0) / pays.length);
  return { coins: avg('coins'), xp: avg('xp') };
}

// "About 6 🪙 and 6 XP each time"
function payNote(kid, task) {
  const p = payAverage(kid, task);
  if (!p) return isEveryOtherWeek(task) ? 'Off this week' : 'Not on any day';
  return `About ${p.coins} 🪙 and ${p.xp} XP each time`;
}

/** "Mon–Fri", "Every day", "Sat"... for a chore's one-line summary. */
function daysLabel(days) {
  const set = [...new Set(days)].sort();
  if (!set.length) return 'No days';
  if (set.length === 7) return 'Every day';
  if (set.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (set.join() === '0,6') return 'Weekends';
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.includes(d)).map((d) => DAY_NAMES[d]).join(', ');
}

/** What a chore earns, in a few characters: "6 🪙", "about 6 🪙" with the allowance, "10 💎" for exercise. */
function payShort(kid, task, allowance) {
  if (isExercise(task)) return `${taskGems(task)} 💎`;
  if (kid.starsOnly) return '⭐';
  if (!allowance) return `${taskCoins(task)} 🪙`;
  const p = payAverage(kid, task);
  return p ? `~${p.coins} 🪙` : 'off';
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
  const missing = HOUSE_CHORES.filter((c) => c.preset && !kid.tasks.some((t) => t.house === c.id));
  if (!missing.length) return '';
  return `<div class="row wrap house-adds"><small class="muted">🏠 Add a house chore:</small>${missing.map((c) => `<button class="btn ghost small-btn" data-action="add-house-task" data-house="${c.id}">+ ${c.icon} ${esc(c.label)}</button>`).join('')}</div>`;
}

function parentEditKid() {
  const kid = kidById(ui.editKidId);
  if (!kid) { ui.editKidId = null; return parentKids(); }
  const allowance = allowanceFor(state, kid);
  const fam = state.settings.allowance;
  // each chore is one line (icon, name, when, pay); tapping it opens all its settings, one at a time
  const taskLine = (t, open) => `
      <button class="task-line" data-action="task-open" data-task="${t.id}" aria-expanded="${open}">
        <span class="tl-icon" aria-hidden="true">${esc(t.icon)}</span>
        <span class="tl-text"><b>${esc(t.name)}</b><small>${esc([isEvening(t) ? 'Evening' : isExercise(t) ? '' : periodName(t), daysLabel(t.days), isEveryOtherWeek(t) ? 'every other week' : '', t.minutes > 0 ? `${t.minutes} min timer` : ''].filter(Boolean).join(' · '))}</small></span>
        <span class="tl-pay">${esc(payShort(kid, t, allowance))}</span>
        <span class="chev" aria-hidden="true">${open ? '▲' : '▼'}</span>
      </button>`;
  const taskRows = (period) => kid.tasks.filter((t) => routineOfTask(t) === period).map((t) => (ui.openTask !== t.id ? `
    <div class="task-edit closed" data-task="${t.id}">${taskLine(t, false)}</div>` : `
    <div class="task-edit open" data-task="${t.id}">
      ${taskLine(t, true)}
      <div class="row">
        <input class="icon-input" data-field="icon" value="${esc(t.icon)}" aria-label="Icon">
        <input class="grow" data-field="name" value="${esc(t.name)}" aria-label="Chore name">
        <button class="btn ghost round" data-action="move-task" data-task="${t.id}" data-dir="-1" aria-label="Move up">↑</button>
        <button class="btn ghost round" data-action="move-task" data-task="${t.id}" data-dir="1" aria-label="Move down">↓</button>
        <button class="btn ghost round danger-text" data-action="delete-task" data-task="${t.id}" aria-label="Delete">✕</button>
      </div>
      <div class="days">${dayChips(t)}</div>${repeatRow(kid, t)}
      <div class="row wrap plan-edit">
        <label>Days <select data-field="kidDays" aria-label="Who picks the days">
          <option value="0" ${t.kidDays > 0 ? '' : 'selected'}>Set by you (above)</option>
          ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${t.kidDays === n ? 'selected' : ''}>${esc(kid.name)} picks ${n} ${n === 1 ? 'day' : 'days'} a week</option>`).join('')}
        </select></label>
        ${isExercise(t) ? '' : `<label class="row"><input type="checkbox" data-field="pinned" ${isPinned(t) ? 'checked' : ''}> 📌 Stays in this routine</label>`}
      </div>
      ${t.kidDays > 0 ? `<small class="muted task-hint">${esc(kid.name)} picks the days in Plan my week. Until then it's on the days ticked above.</small>` : ''}
      <div class="row wrap">
        <label>When <select data-field="period"><option value="morning" ${routineOfTask(t) === 'morning' ? 'selected' : ''}>Morning</option><option value="afternoon" ${routineOfTask(t) === 'afternoon' ? 'selected' : ''}>After school</option><option value="evening" ${routineOfTask(t) === 'evening' ? 'selected' : ''}>Evening</option><option value="exercise" ${t.period === 'exercise' ? 'selected' : ''}>Bonus exercise</option></select></label>
        <label>Checked by <select data-field="verify"><option value="self" ${t.verify === 'self' ? 'selected' : ''}>Kid taps done</option><option value="parent" ${t.verify === 'parent' ? 'selected' : ''}>Parent PIN</option></select></label>
        <label>Timer <input type="number" min="0" max="180" step="5" data-field="minutes" value="${t.minutes}" class="num"> min</label>
        ${isExercise(t) ? '' : `<label>House chore <select data-action-change="task-house" data-task="${t.id}" aria-label="House chore">
          <option value="" ${t.house ? '' : 'selected'}>None</option>
          ${HOUSE_CHORES.map((c) => `<option value="${c.id}" ${t.house === c.id ? 'selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('')}
        </select></label>`}
        ${t.minutes > 0 ? `<label class="row"><input type="checkbox" data-field="background" ${t.background ? 'checked' : ''}> Keep counting in other apps</label>
        <label class="row"><input type="checkbox" data-field="listen" ${t.listen ? 'checked' : ''}> Listen to the piano</label>` : ''}
      </div>
      ${t.minutes > 0 && t.listen ? '<small class="muted task-hint">While the timer runs, the buddy listens and dances to the playing. With no piano for 30 seconds it gets bored; after a minute it falls asleep and the timer pauses until the piano starts again. It uses the microphone only on the timer screen, and nothing is recorded. Try it in Settings › Test tools › Piano listening test.</small>' : ''}
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
    </div>`)).join('');
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
        <small class="muted allow-help">Leave empty to use the family's amount (Settings). A perfect week earns exactly this, split across ${esc(kid.name)}'s chores by size.</small>
      </div>` : ''}
    </div>
    <div class="card chore-set">
      <div class="block">Chore set <div class="row wrap">${CHORE_SETS.map((cs) => `<button class="btn ${kid.choreSet === cs.id ? '' : 'ghost'} small-btn" data-action="kid-set" data-set="${cs.id}">${esc(cs.name)} (${esc(cs.ages)})</button>`).join('')}</div>
        <small class="muted">${esc(choreSetById(kid.choreSet)?.note || 'Pick a starter set for their age, then change anything below. Switching adds the set\'s chores and takes off the ones it replaces; piano and your own chores stay.')}</small></div>
      <label class="row"><input type="checkbox" data-kidflag="starsOnly" ${kid.starsOnly ? 'checked' : ''}> Stars only: chores earn XP and cheers, no coins (for the littlest)</label>
      <label class="row"><input type="checkbox" data-kidflag="littleGames" ${kid.littleGames ? 'checked' : ''}> Little games: a bakery and animal puzzles with pictures only. Each chore they finish also drops a star in their jar (coins stay the same); a star opens a game.</label>
      <label class="row"><input type="checkbox" data-kidflag="planWithGrownUp" ${kid.planWithGrownUp ? 'checked' : ''}> Plans with a grown-up: bigger pictures in Plan my week</label>
      <button class="btn ghost small-btn" data-action="charts" data-kid="${kid.id}">🖨️ Print ${esc(kid.name)}'s chart${chartOutdated(kid) ? ' (plan changed)' : ''}</button>
      ${kid.plan?.signed ? `<small class="muted">📝 ${esc(kid.name)} signed a plan for the week of ${esc(shortDate(kid.plan.signed))}. Change it together with them in Plan my week, so it stays theirs.</small>` : ''}
    </div>
    <h2>🌅 Morning chores</h2>
    ${taskRows('morning')}
    <button class="btn ghost" data-action="add-task" data-period="morning">+ Add morning chore</button>
    ${houseAdds(kid)}
    <h2>☀️ After-school chores</h2>
    ${taskRows('afternoon')}
    <button class="btn ghost" data-action="add-task" data-period="afternoon">+ Add after-school chore</button>
    <h2>🌙 Evening chores</h2>
    ${taskRows('evening') || '<p class="muted small">None yet. Night teeth, pajamas or a shower after dinner go here.</p>'}
    <button class="btn ghost" data-action="add-task" data-period="evening">+ Add evening chore</button>
    <small class="muted section-hint">Evening chores don't keep the buddy shop shut, so the shop can open after the day chores. If one is missed, the next day the shop waits for every chore, evening ones too.</small>
    <h2>💪 Bonus exercise</h2>
    ${taskRows('exercise') || '<p class="muted small">None yet. Add a run, a bike ride, soccer practice or anything active.</p>'}
    <button class="btn ghost" data-action="add-task" data-period="exercise">+ Add exercise</button>
    <p class="muted small">Exercise is optional: they never count toward the streak or the day's treasure. Each one earns ${DEFAULT_GEMS} 💎 gems unless you type another amount. Gems only buy sports gear. Exercising on ${EXERCISE_DAYS} days in a week (Monday to Sunday) makes a "strong week", and strong weeks unlock moves for the kid's buddy at 1, 3 and 6. A week with exactly ${EXERCISE_KEEP_DAYS} exercise days keeps the count without adding to it, and a week with fewer takes one strong week away. Moves already unlocked are never taken away. A day you excuse in Past days (sick, travel) counts neither for nor against it: that week just needs one fewer exercise day for each mark, and a week with ${EXERCISE_DAYS} or more excused days is skipped. You can excuse days afterwards too, and streaks update right away.</p>
    <p class="muted small">🏠 House chores show in ${esc(kid.name)}'s buddy house in the village: an unmade bed until “Make bed” is done, the toothbrush out until the morning “Brush teeth” is done (and again in the evening until the night one is), and a messy floor until “Pick up bedroom floor” is done (messier after 2 days, very messy after 4). Pick which chore is which with “House chore”, or add one ready-made. Each can be linked to one chore at a time. Chores that aren't linked don't change the house.</p>
    <p class="muted small">A chore can repeat every other week (weeks run Monday to Sunday). To have two kids take turns, like cleaning the bathroom, set the chore to every other week for one kid, then tap the other kid's name next to “Take turns with”: they get the same chore on the opposite weeks. On a kid's off week the chore isn't on their list at all, so it never counts against their streak or the day's treasure.</p>
    <p class="muted small">Changes apply from today. Past days keep the chores they had. A timer chore (like piano) counts minutes only while the app is open, unless you tick “Keep counting in other apps” (for an app like Note Rush). Time spent in other apps shows when you approve it. ${allowance ? `${esc(kid.name)} earns up to ${allowance.coins} coins and ${allowance.xp} XP a week. It is split across the week's chores by size: a big chore is worth 3 small ones, a medium one 2. A kid with more chores doesn't earn more, each chore is just worth a little less, and a missed chore loses its share. Exercise is extra: it earns gems and its own XP.` : 'Each chore earns 10 coins and 10 XP (30 for a timer chore) unless you type other amounts; leave a box empty to use the default.'} Changes count from today, so coins already earned stay earned. Every 100 XP is a level.</p>
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
    <p class="muted small">Streaks update right away, so approving yesterday's chores late keeps the streak.</p>`;
}

function parentSettings() {
  const st = state.settings;
  const notif = 'Notification' in window ? Notification.permission : 'unsupported';
  return `
    <div class="card">
      <label class="block">Weekly reward (on Friday, for a kid who did every chore Monday to Friday; excused days don't count against it)
        <input data-setting="weeklyReward" value="${esc(st.weeklyReward)}"></label>
      <div class="row wrap">
        <label>Morning chores by <input type="time" data-setting="morningBy" value="${esc(st.morningBy)}"></label>
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
${printCardHtml()}
    <div class="card">
      <h2>Parent PIN</h2>
      ${parentDevice() ? '<p class="muted small">This phone is signed in to the family as a parent, so it opens Parents without the PIN. Kids’ devices still ask for it.</p>' : ''}
      <button class="btn ghost" data-action="change-pin">Change PIN</button>
    </div>
    <div class="card">
      <h2>Backup</h2>
      ${backupText()}
    </div>
    ${familyCard()}
    <div class="card test-tools">
      <button class="test-tools-row" data-action="test-tools" aria-expanded="${Boolean(ui.testTools)}">
        <span class="grow"><b>🧪 Test tools</b><small class="muted">Try the games, the studio, the Note-o-Matic and the seasons, test piano listening, save a test recording. The kids' progress is not touched.</small></span>
        <span class="chev" aria-hidden="true">${ui.testTools ? '▲' : '▼'}</span>
      </button>
    </div>
    ${ui.testTools ? testTools() : ''}`;
}

/** Settings › Test tools: shown only once the row is opened. */
function testTools() {
  return `
${gameTestCard()}
    <div class="card studio-test">
      <h2>🎚️ Try the recording studio</h2>
      <p class="muted small">Open the recording studio right away to see how it works. This is a test desk: the kids' mixes and stickers are not touched.</p>
      <button class="btn" data-action="studio-test">Open the studio</button>
    </div>
    <div class="card lab-test">
      <h2>🤖 Try the Note-o-Matic</h2>
      <p class="muted small">Play the piano to the robot and see the notes it makes. This is a test desk: its tunes go on the test studio's shelf, and the kids' tunes are not touched.</p>
      <button class="btn" data-action="lab-test">Open the Note-o-Matic</button>
    </div>
    <div class="card compose-test">
      <h2>✍️ Try the composing desk</h2>
      <p class="muted small">Write a song step by step, with every help level open. This is a test desk: its songs are its own, and the kids' songs are not touched.</p>
      <button class="btn" data-action="compose-test">Open the composing desk</button>
    </div>
${seasonTestCard()}
    <div class="card">
      <h2>🎹 Piano listening test</h2>
      <p class="muted small">Try how well the tablet hears piano playing. To have a kid’s practice timer listen, turn on “Listen to the piano” for that chore in Kids. Nothing is recorded or saved.</p>
      <button class="btn ghost" data-action="listen-open">Open the listening test</button>
    </div>
    <div class="card rec-test">
      <h2>🎙️ Save a test recording</h2>
      <p class="muted small">Record up to 2 minutes of piano through the tablet's microphone and save it as a sound file. Nothing is kept in the game.</p>
      <div id="rec-test"></div>
    </div>
    <div class="card nfc-test-card">
      <h2>📡 NFC token test</h2>
      <p class="muted small">See how this phone reads the NFC stickers in chore tokens: where to hold them, how far away, how fast. Works in Chrome on an Android phone with NFC. Nothing is saved, and the kids' data is not touched.</p>
      <button class="btn ghost" data-action="nfc-open">Open the NFC test</button>
    </div>`;
}

/**
 * What the backup card says. The file is this device's copy (state as it is here):
 * on a kid's device that is only that kid, on a parent's phone the whole family.
 */
function backupText() {
  if (!cloudCfg) {
    return `
      <p class="muted small">Everything is saved only on this device. Save a backup file now and then (for example to Google Drive) so a reset or a new device doesn't lose streaks.</p>
      <div class="row wrap">
        <button class="btn" data-action="export">Save backup file</button>
        <label class="btn ghost">Restore from file<input type="file" accept="application/json,.json" data-action-change="import" hidden></label>
      </div>`;
  }
  const kidName = cloudCfg.role === 'kid' ? kidById(cloudCfg.kidId)?.name : null;
  return `
      <p class="muted small">Progress is kept in your family's cloud. A backup file is still a handy extra copy${kidName ? `. This device holds only ${esc(kidName)}'s progress, so its file has only ${esc(kidName)}; a parent's phone saves the whole family` : ' of the whole family'}.</p>
      <div class="row wrap"><button class="btn" data-action="export">Save backup file</button></div>`;
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
      <small class="muted allow-help">Every kid can earn the same amount for a perfect week, however many chores they have. It is split across each kid's chores by size (set in Kids). You can give one kid a different amount in their page. On top of it, either parent can give a 🎁 bonus with a reason, up to the bonus limit; bonuses also add the same XP. Changes count from today.</small>` : '<small class="muted">Off: each chore earns the coins and XP typed on it in Kids.</small>'}
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
      ${item.noHold ? `<div class="buddy buddy-xl home-buy"><img class="home-thumb" src="${boatThumb()}" alt=""></div>` : `<div class="buddy buddy-xl mood-happy">${buddySvg(preview, 'happy')}</div>`}
      <h1>Buy ${esc(item.name)}?</h1>
      <p>It costs <b>💎 ${item.gems}</b>. You'll have ${prog.gems - item.gems} gems left.</p>
      <p class="muted small">${item.noHold ? 'When you go fishing, you and your visitor row out into deep water, where the bigger fish swim. Every buddy can use it.' : 'Every buddy can use it. Keep exercising to unlock its moves.'}</p>
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

const views = { setup: viewSetup, home: viewHome, kid: viewKid, timer: viewTimer, watch: viewWatch, songbook: viewSongbook, studio: viewStudio, lab: viewLab, compose: viewCompose, parent: viewParent, wardrobe: viewWardrobe, listen: viewListen, nfc: viewNfc };

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
  for (const k of state.kids) if (linkRoomChores(k)) changed = true;
  for (const k of state.kids) if (restoreBackup(k, undefined, totalCoins(state, k, today()))) changed = true;
  for (const k of state.kids) if (restoreTasks(k)) changed = true;
  for (const k of state.kids) if (restoreFromRecord(k)) changed = true;
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
  // On a family device, nothing here is saved until the family's copy has come from the
  // server: this device's own copy may be days old, and what's worked out from it (today's
  // pay, the day summaries, a kid who seems never to have had the shop) would be sent to
  // the family over newer data. The kid's own taps still save as usual.
  if (cloudCfg && !cloud.gotState) return;
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
  // a single kid's own device opens straight on their page (the back arrow still leads to the picker and Parents)
  if (ui.view === 'home' && ui.autoKid && state.kids.length) {
    ui.autoKid = false;
    if (state.kids.length === 1 && !parentDevice()) { ui.view = 'kid'; ui.kidId = state.kids[0].id; setTimeout(() => { if (ui.view === 'kid') celebrateIfDue(kidById(ui.kidId)); }, 300); }
  }
  // the store closes again on a new day, even if the wardrobe was left open overnight
  if (ui.view === 'wardrobe' && !storeOpen(state, kidById(ui.kidId), today()).open) ui.view = 'kid';
  const keepScroll = ui.view === 'parent' || ui.view === 'wardrobe' || ui.view === 'songbook' || ui.view === 'studio' || ui.view === 'lab' || ui.view === 'compose';
  if (ui.view === 'kid' && lastView !== 'kid') partyDue = true; // the map just opened
  const html = withMemo(() => { reconcile(); return (views[ui.view] || viewHome)(); });
  // the kid's screen fills the whole screen and the page doesn't scroll
  const full = ui.view === 'kid';
  if (document.documentElement.classList.contains('kid-full') !== full) document.documentElement.classList.toggle('kid-full', full);
  // load the sign-in code early, so a sign-in popup opens straight from the tap
  if (ui.view === 'setup' || (ui.view === 'parent' && ui.tab === 'settings')) loadCloud().catch(() => {});
  // Family sync can ask for a redraw many times a minute (another tablet saving, a piano timer
  // ticking). When nothing on screen changed, leave the page alone: the visitors don't arrive
  // again, the fish keep swimming and a half-scrolled row stays where it is.
  if (html === lastHtml && $app.firstElementChild) { syncMusic(); maybeParty(); greetCheers(); return; }
  const sameView = lastView === ui.view;
  const side = sameView ? [...$app.querySelectorAll(SIDE_SCROLLERS)].map((el) => el.scrollLeft) : [];
  // leaving the kid's page (the shop, the piano timer, the music house's screens) remembers where
  // it was, and coming back puts it there again, the village in view
  if (lastView === 'kid' && ui.view !== 'kid') ui.kidScroll = scrollY;
  const back = ui.view === 'kid' && lastView && lastView !== 'kid' && lastView !== 'home' && ui.kidScroll != null;
  $app.innerHTML = html;
  lastHtml = html;
  lastView = ui.view;
  if (full) { if (window.scrollY) window.scrollTo(0, 0); } else if (back) window.scrollTo(0, ui.kidScroll);
  $app.querySelectorAll(SIDE_SCROLLERS).forEach((el, i) => { if (side[i]) el.scrollLeft = side[i]; });
  mountVillages($app, villageHandlers);
  mountHouses($app, houseHandlers);
  mountGardens($app, gardenHandlers);
  mountMusicHouses($app, musicHandlers);
  mountSongbook($app);
  mountStudio($app);
  mountTestRec($app);
  mountNfcTest($app);
  mountLab($app);
  mountCompose($app);
  liveStart();
  syncMusic();
  if (keepScroll) window.scrollTo(0, scrollY);
  maybeParty();
  greetCheers();
}

/**
 * Map music plays only on the kid's screen (the village and its buildings), with sound on and
 * music not muted, while the app is visible. Inside a building (the buddy's house, the music
 * house) it is muffled, as if heard from outside; the garden is outdoors, so it plays clearly
 * there. In the house, the kid's turntable (turntable.js) plays instead when it's on (even with
 * the map music muted, since the kid put it on).
 */
function syncMusic() {
  const onMap = ui.view === 'kid';
  const kid = kidById(ui.kidId);
  const heard = onMap && state.settings.sound && document.visibilityState === 'visible';
  const place = heard && kid ? placeOf(kid.id, today()) : 'out';
  const inHouse = place === 'house';
  // the music house only stands once the kid has a piano (villageView shows the village otherwise)
  const indoors = inHouse || (place === 'music' && Boolean(musicTier(progressFor(kid))));
  muffleMusic(indoors);
  if (houseRecord(kid, inHouse)) { stopMusic(); return; }
  if (heard && state.settings.music !== false) startMusic(kidTheme(kid || {}));
  else stopMusic();
}
setTurntableSync(() => syncMusic());

// ---------- events ----------

const actions = {
  'setup-pin': () => pinPad({ title: 'Choose a parent PIN', subtitle: 'Pick 4 digits the kids don’t know', mode: 'new', onSuccess: () => { ui.view = 'parent'; ui.tab = 'kids'; render(); toast('PIN saved. Now add your kids.'); } }),
  home: () => { ui.view = 'home'; ui.kidScroll = null; render(); },
  'open-kid': (el) => {
    ui.kidId = el.dataset.id; ui.view = 'kid'; ui.kidScroll = null; render();
    setTimeout(() => celebrateIfDue(kidById(ui.kidId)), 300);
  },
  'timer-start': () => { wakeEars(); startTimer(true); startEars(); },
  'timer-pause': () => { stopEars(); stopTimer(); },
  'timer-buddy': () => buddyCheer(),
  'timer-back': () => { stopEars(); stopTimer(false); ui.view = 'kid'; render(); },
  'watch-back': () => { stopEars(); stopTimer(false); ui.view = 'kid'; render(); },
  parent: () => {
    const open = () => { ui.view = 'parent'; ui.tab = 'today'; ui.editKidId = null; render(); window.scrollTo(0, 0); };
    if (parentDevice()) open();
    else pinPad({ title: 'Parents only', subtitle: 'Type the parent PIN', onSuccess: open });
  },
  'listen-open': () => { ui.view = 'listen'; ui.listenKid = ui.listenKid || state.kids[0]?.id; render(); window.scrollTo(0, 0); },
  'listen-back': () => { stopListenTest(); ui.view = 'parent'; ui.tab = 'settings'; ui.testTools = true; render(); },
  'nfc-open': () => { ui.view = 'nfc'; render(); window.scrollTo(0, 0); },
  'nfc-back': () => { ui.view = 'parent'; ui.tab = 'settings'; ui.testTools = true; render(); },
  'test-tools': () => { ui.testTools = !ui.testTools; render(); },
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
  tab: (el) => { const again = ui.tab === el.dataset.tab; ui.tab = el.dataset.tab; ui.editKidId = null; render(); if (!again) window.scrollTo(0, 0); },
  approve: (el) => approve(el.dataset.kid, el.dataset.key, el.dataset.task),
  'reward-given': (el) => {
    const kid = kidById(el.dataset.kid);
    const { monday } = el.dataset;
    if (!kid) return;
    markRewardGiven(kid, monday, Date.now());
    save(); sounds.task(); render();
    toast(`${kid.name}'s reward is checked off`, { label: 'Undo', run: () => { const k = kidById(kid.id); if (k) { markRewardGiven(k, monday, null); save(); render(); } } });
  },
  'approve-all': () => {
    const changes = pendingApprovals(state, today()).map(({ kid, key, task }) => applyTaskChange(state, kid.id, key, task.id, { status: 'done', by: 'parent', at: Date.now() }));
    if (!changes.length) return;
    save(); sounds.task(); render();
    undoToast(`Approved ${changes.length} chore${changes.length === 1 ? '' : 's'}`, changes);
  },
  'send-back': (el) => {
    const kid = kidById(el.dataset.kid);
    const task = kid && taskById(kid, el.dataset.key, el.dataset.task);
    if (!task) return;
    const change = setTask(kid, el.dataset.key, task, null);
    render();
    undoToast(`${task.name} sent back to ${kid.name}`, [change]);
  },
  'today-kid': (el) => { const id = el.dataset.kid; if (ui.todayOpen.has(id)) ui.todayOpen.delete(id); else ui.todayOpen.add(id); render(); },
  'today-show-done': (el) => { const id = el.dataset.kid; if (ui.todayDone.has(id)) ui.todayDone.delete(id); else ui.todayDone.add(id); render(); },
  'today-tick': (el) => {
    const kid = kidById(el.dataset.kid);
    const task = kid && taskById(kid, today(), el.dataset.task);
    if (!task) return;
    const change = setTask(kid, today(), task, { status: 'done', by: 'parent', at: Date.now() });
    sounds.task(); render();
    undoToast(`${task.name} done for ${kid.name}${payText(kid, today(), task)}`, [change]);
  },
  'today-untick': (el) => {
    const kid = kidById(el.dataset.kid);
    const task = kid && taskById(kid, today(), el.dataset.task);
    if (!task) return;
    const change = setTask(kid, today(), task, null);
    render();
    undoToast(`${task.name} un-ticked for ${kid.name}`, [change]);
  },
  'today-excuse': (el) => {
    const kid = kidById(el.dataset.kid);
    if (!kid) return;
    const t = today();
    const was = entryFor(state, kid.id, t)?.excused;
    const setExcused = (k, v) => { const e = entryFor(state, k.id, t, true); if (v === undefined) delete e.excused; else e.excused = v; save(); render(); };
    setExcused(kid, !was);
    toast(was ? `${kid.name}'s day is no longer excused` : `${kid.name}'s day is excused. The streak is kept.`, { label: 'Undo', run: () => { const k = kidById(kid.id); if (k) setExcused(k, was); } });
  },
  'today-chores': (el) => { ui.tab = 'kids'; ui.editKidId = el.dataset.kid; ui.openTask = null; render(); window.scrollTo(0, 0); },
  'rewards-see': () => { ui.showRewards = !ui.showRewards; render(); },
  'add-kid': () => {
    const n = state.kids.length;
    const kid = { id: newId('kid'), name: `Kid ${n + 1}`, buddy: defaultBuddy(SPECIES[n % SPECIES.length].id), seenUnlocks: [], color: COLORS[(n * 2) % COLORS.length], tasks: defaultTasks(), startDate: today() };
    state.kids.push(kid); save();
    ui.editKidId = kid.id; render();
  },
  'edit-kid': (el) => { ui.editKidId = el.dataset.id; ui.openTask = null; render(); window.scrollTo(0, 0); },
  'task-open': (el) => {
    const id = el.dataset.task;
    ui.openTask = ui.openTask === id ? null : id;
    render();
    // keep the chore in view: the one closed above it may have been tall
    document.querySelector(`.task-edit[data-task="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  },
  'edit-kid-done': () => { ui.editKidId = null; render(); },
  'kid-species': (el) => { changeSpecies(kidById(ui.editKidId), el.dataset.val); save(); render(); },
  wardrobe: () => {
    const lock = storeOpen(state, kidById(ui.kidId), today());
    if (!lock.open) { sounds.error(); toast(`🔒 ${storeLockText(lock)}`); return; }
    ui.view = 'wardrobe'; ui.speciesOpen = false; render(); window.scrollTo(0, 0);
  },
  'wardrobe-back': () => { ui.view = 'kid'; ui.speciesOpen = false; render(); },
  // picking another kind of buddy is a choice made on purpose: the picker opens from its own button
  'wardrobe-switch': () => { ui.speciesOpen = !ui.speciesOpen; sounds.tap(); render(); },
  'wardrobe-slot': (el) => { ui.slot = el.dataset.slot; render(); },
  'wardrobe-species': (el) => { changeSpecies(kidById(ui.kidId), el.dataset.val); ui.speciesOpen = false; sounds.tap(); save(); render(); },
  'wardrobe-item': (el) => {
    const kid = kidById(ui.kidId);
    const item = itemById(el.dataset.id);
    if (!item || !fitsSpecies(item, kid.buddy.species)) return;
    const prog = progressFor(kid);
    if (!isUnlocked(item, prog) && needsMusicHouse(item) && !musicTier(prog)) { sounds.error(); toast('🔒 This opens with your music house. Keep up your piano streak to earn your first piano!'); return; }
    if (!isUnlocked(item, prog) && comingSoon(item)) { sounds.error(); toast(releaseDay(item) ? `🔒 ${item.name} comes to the shop on ${releaseLabel(releaseDay(item))}!` : `🔒 ${item.name} is coming soon. Its song is still being written!`); return; }
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
    if (item.noHold) { sounds.tap(); toast('Your boat is waiting at the lake! 🚣 Go fishing with a visiting buddy to row out.'); return; }
    const outfit = kid.buddy.outfit;
    if (outfit[item.slot] === item.id && item.slot !== 'background') delete outfit[item.slot];
    else { outfit[item.slot] = item.id; putAwayOther(kid, item.slot); }
    kid.newItems = (kid.newItems || []).filter((id) => id !== item.id);
    sounds.task(); save(); render();
  },
  'garden-buy': (el) => {
    const kid = kidById(ui.kidId);
    if (kid) buyGarden(kid, el.dataset.kind, el.dataset.id, progressFor(kid));
  },
  'garden-buy-confirm': (el) => {
    const kid = kidById(ui.kidId);
    const kind = el.dataset.kind;
    const item = kind === 'seed' ? seedById(el.dataset.id) : decorById(el.dataset.id);
    const prog = kid && progressFor(kid);
    if (!kid || !item?.price || prog.coins < item.price) { closeModal(); return; }
    if (kind === 'seed') buySeed(kid, item.id);
    else {
      if (prog.owned.includes(item.id)) { closeModal(); return; }
      kid.spent = (kid.spent || 0) + item.price;
      addOwned(kid, item);
      kid.gardenDecor = { ...(kid.gardenDecor || {}), [item.spot]: item.id };
    }
    save();
    closeModal();
    sounds.day();
    confetti(60, 1400);
    toast(kind === 'seed' ? `${item.name} seeds are yours! Plant them in your garden.` : `${item.name} is in your garden!`);
    render();
  },
  today: () => { sounds.tap(); openToday(kidById(ui.kidId)); },
  'today-go': (el) => { sounds.tap(); goQuest(kidById(ui.kidId), el.dataset.id); },
  'today-ask': (el) => {
    const kid = kidById(ui.kidId);
    const task = kid && taskById(kid, today(), el.dataset.id);
    closeModal();
    if (task) askParentNowOrLater(kid, task, null);
  },
  'today-chest': () => { closeModal(); const kid = kidById(ui.kidId); if (kid) openChest(kid, today()); },
  'today-shop': () => { closeModal(); actions.wardrobe(); },
  chest: (el) => {
    const kid = kidById(ui.kidId);
    const key = el.dataset.day || today();
    const c = chestFor(kid, key);
    if (c.ready) return openChest(kid, key);
    if (c.opened) { sounds.day(); confetti(60, 1500); toast(`Today's treasure: ${chestTitle(c.opened)}`); return; }
    sounds.tap();
    if (c.s.complete) toast('See you tomorrow for another chest!');
    else toast(`${c.s.total - c.s.done} more to reach the ${c.tier.name.toLowerCase()}!`);
  },
  trophies: () => openTrophies(kidById(ui.kidId)),
  'buy-confirm': (el) => {
    const kid = kidById(ui.kidId);
    const item = itemById(el.dataset.id);
    const prog = progressFor(kid);
    if (!item || prog.owned.includes(item.id) || !fitsSpecies(item, kid.buddy.species)) { closeModal(); return; }
    if (needsMusicHouse(item) && !musicTier(prog)) { closeModal(); return; }
    if (comingSoon(item)) { closeModal(); return; }
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
    else if (!item.noHold) {
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
    confirmModal({ title: 'Delete chore?', text: `Remove "${task.name}" for ${kid.name}?`, yes: 'Delete', danger: true, onYes: () => { kid.tasks = kid.tasks.filter((t) => t.id !== task.id); save(); render(); } });
  },
  'add-task': (el) => {
    const ex = el.dataset.period === 'exercise';
    const eve = el.dataset.period === 'evening';
    const task = { id: newId('task'), name: ex ? 'Exercise' : 'New chore', icon: ex ? '🏃' : eve ? '🌙' : '⭐', period: eve ? 'afternoon' : el.dataset.period, ...(eve ? { evening: true } : {}), days: [0, 1, 2, 3, 4, 5, 6], verify: ex ? 'parent' : 'self', minutes: 0 };
    kidById(ui.editKidId).tasks.push(task);
    ui.openTask = task.id; // a new chore opens straight away
    save(); render();
    document.querySelector(`.task-edit[data-task="${task.id}"]`)?.scrollIntoView({ block: 'center' });
  },
  'kid-set': (el) => {
    const kid = kidById(ui.editKidId);
    const set = choreSetById(el.dataset.set);
    if (!kid || !set) return;
    const { add, remove } = setChanges(kid, set.id);
    const list = (xs) => xs.join(', ');
    const what = [
      add.length ? `Adds: ${list(add.map((k) => `${SET_CHORES[k].name}${k === 'teeth-night' ? ' (night)' : ''}`))}.` : '',
      remove.length ? `Takes off: ${list(remove.map((t) => t.name))}.` : '',
    ].filter(Boolean).join(' ');
    if (!what) { kid.choreSet = set.id; save(); render(); toast(`${kid.name} already has every ${set.name} chore`); return; }
    confirmModal({ title: `Use the ${set.name} set for ${kid.name}?`, text: `${what} Past days keep the chores they had.`, yes: 'Use it', onYes: () => { applySet(kid, set.id, newId); save(); render(); } });
  },
  'add-house-task': (el) => {
    const kid = kidById(ui.editKidId);
    const role = el.dataset.house;
    if (!kid || !houseChoreById(role)) return;
    const task = houseTask(role, newId('task'));
    kid.tasks.push(task);
    const cleared = setHouseRole(kid.tasks, task.id, role);
    ui.openTask = task.id;
    save(); render();
    document.querySelector(`.task-edit[data-task="${task.id}"]`)?.scrollIntoView({ block: 'center' });
    if (cleared.length) toast(`“${cleared[0].name}” is no longer the house's ${houseChoreById(role).label.toLowerCase()} chore`);
  },
  'delete-kid': () => {
    const kid = kidById(ui.editKidId);
    confirmModal({ title: `Remove ${kid.name}?`, text: cloudCfg
      ? `${kid.name} and their chores are removed from every device in the family, kid's tablet included. Their past days stay in the family's cloud but no longer show anywhere.`
      : 'Their chores, streak and history are removed from this device. Only a backup file can bring them back.', yes: 'Remove', danger: true, onYes: () => { state.kids = state.kids.filter((k) => k.id !== kid.id); ui.editKidId = null; save(); render(); } });
  },
  'history-toggle': (el) => {
    const kid = kidById(el.dataset.kid);
    const key = el.dataset.key;
    const task = tasksForDay(state, kid, key, today()).find((t) => t.id === el.dataset.task);
    const st = entryFor(state, kid.id, key)?.tasks?.[task.id]?.status;
    const change = setTask(kid, key, task, st === 'done' ? null : { status: 'done', by: 'parent', at: Date.now() });
    render();
    undoToast(st === 'done' ? `${task.name} un-ticked for ${kid.name}` : `${task.name} done for ${kid.name}${payText(kid, key, task)}`, [change]);
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
  const task = kid && taskById(kid, key, taskId);
  if (!task) return;
  const change = setTask(kid, key, task, { status: 'done', by: 'parent', at: Date.now() });
  sounds.task(); render();
  undoToast(`${task.name} approved for ${kid.name}${payText(kid, key, task)}`, [change]);
}

/** " · +6 🪙 +6 XP": what a chore pays on a day, for the toast. */
function payText(kid, key, task) {
  const { xp, coins, gems } = taskPay(state, kid, key, task, today());
  const bits = [coins && `+${coins}\u00a0🪙`, gems && `+${gems}\u00a0💎`, xp && `+${xp}\u00a0XP`].filter(Boolean);
  return bits.length ? ` · ${bits.join(' ')}` : '';
}

/**
 * A toast with Undo for a parent's tick, un-tick, approval or send-back. Undo
 * puts each chore's record back as it was (so its coins and XP too), unless the
 * chore has changed since, on this phone or another.
 */
function undoToast(text, changes) {
  toast(text, {
    label: 'Undo',
    run: () => {
      const n = undoTaskChanges(state, changes);
      if (n) { save(); sounds.tap(); render(); }
      if (n < changes.length) toast(n ? `Undone, except ${changes.length - n} that changed since` : 'That chore has changed since, so it was left as it is.');
    },
  });
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
    if (el.dataset.field === 'name' && !v.trim()) v = 'Chore';
    const isReward = el.dataset.field === 'coins' || el.dataset.field === 'xp' || el.dataset.field === 'gems';
    if (isReward) v = parseReward(v);
    if (el.dataset.field === 'size') v = Number(v);
    if (el.dataset.field === 'kidDays') v = Number(v) > 0 ? Number(v) : null;
    // Evening is a routine of its own: an after-school-side chore marked evening
    if (el.dataset.field === 'period') {
      if (v === 'evening') { task.period = 'afternoon'; task.evening = true; } else { task.period = v; delete task.evening; }
      save(); render(); return;
    }
    if (v === null) delete task[el.dataset.field];
    else task[el.dataset.field] = v;
    save();
    if (el.tagName === 'SELECT' || el.dataset.field === 'minutes' || el.dataset.field === 'listen' || el.dataset.field === 'evening' || el.dataset.field === 'pinned' || isReward) render();
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
  if (el.dataset.kidflag) {
    const kid = kidById(ui.editKidId);
    if (el.checked) kid[el.dataset.kidflag] = true; else delete kid[el.dataset.kidflag];
    // the little games' stars count from the day they're turned on (turning them off and on keeps the stickers)
    if (el.dataset.kidflag === 'littleGames' && el.checked && !kid.little?.since) kid.little = { ...newLittle(today()), ...(kid.little || {}), since: today() };
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
    if (cloudCfg) {
      // a family device: whatever it saves goes to every device, so only put back what's missing
      confirmModal({
        title: 'Put back from backup?',
        text: 'This device syncs with your family, so the backup only puts back what is missing: things a kid bought and days with no record. Nothing the family has now is removed or changed.',
        yes: 'Put back',
        onYes: () => {
          if (familyBehind()) { toast('Wait for the family’s latest copy first, then try again.'); return; }
          const got = migrate(data);
          const r = mergeBackup(state, got);
          if (r.items || r.days) save();
          render();
          toast(r.kids ? `Put back ${r.items} thing${r.items === 1 ? '' : 's'} and ${r.days} day${r.days === 1 ? '' : 's'}` : 'None of the kids in that backup are in this family.');
        },
      });
      return;
    }
    confirmModal({
      title: 'Restore backup?',
      text: `This replaces everything on this device with the backup (${data.kids.length} kids). The parent PIN becomes the one from the backup.`,
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
  if (!v || !doMove(el, { ...v, buddy: dressedVisitor(v) })) { sounds.tap(); live(`visit:${el.dataset.id}`).giggle(); }
};

// ---------- playing with a visitor (see play-ui.js) ----------

// the leaderboard's This week / All time tabs
Object.assign(actions, songbookActions);
Object.assign(actions, studioActions);
Object.assign(actions, labActions);
Object.assign(actions, composeActions);
actions['lb-mode'] = (el) => openLeaderboard(kidById(ui.kidId), el.dataset.mode);

// the fish book: a fish's own page, and back to the book where it was
actions['fish-page'] = (el) => {
  ui.fbScroll = $modal.querySelector('.modal-card')?.scrollTop || 0;
  openFishPage(kidById(ui.kidId), el.dataset.species);
};
actions['fish-book-back'] = () => openFishBook(kidById(ui.kidId), ui.fbScroll || 0);
// the book in the house holds two books: fish and the treasure hill finds
actions['book-tab'] = (el) => { sounds.tap(); ({ finds: openFindsBook, fans: openFansBook, digs: (kid) => openDigBook(kid, ui.dgTab || 'skeletons') }[el.dataset.book] || openFishBook)(kidById(ui.kidId)); };
actions['find-page'] = (el) => {
  const card = $modal.querySelector('.modal-card');
  ui.fdScroll = card ? card.scrollTop : 0;
  sounds.tap();
  openFindPage(kidById(ui.kidId), el.dataset.key);
};
actions['finds-book-back'] = () => openFindsBook(kidById(ui.kidId), ui.fdScroll || 0);
actions['fan-page'] = (el) => {
  const card = $modal.querySelector('.modal-card');
  ui.fnScroll = card ? card.scrollTop : 0;
  sounds.tap();
  openFanPage(kidById(ui.kidId), el.dataset.id);
};
actions['fans-book-back'] = () => openFansBook(kidById(ui.kidId), ui.fnScroll || 0);
actions['critter-page'] = (el) => {
  ui.caScroll = $modal.querySelector('.modal-card')?.scrollTop || 0;
  openCritterPage(kidById(ui.kidId), el.dataset.critter);
};
actions['album-back'] = () => openCritterAlbum(kidById(ui.kidId), ui.caScroll || 0);
// the dig book (digbook-ui.js): beside the fish book in the house, and the dino dig's displays
const digScroll = () => { const card = $modal.querySelector('.modal-card'); ui.dgScroll = card ? card.scrollTop : 0; };
actions['dig-book'] = () => { sounds.tap(); openDigBook(kidById(ui.kidId), ui.dgTab || 'skeletons'); };
actions['dig-tab'] = (el) => { sounds.tap(); ui.dgTab = el.dataset.tab; openDigBook(kidById(ui.kidId), ui.dgTab); };
actions['dig-dino'] = (el) => { digScroll(); sounds.tap(); openDinoPage(kidById(ui.kidId), el.dataset.id); };
actions['dig-treasure'] = (el) => { digScroll(); sounds.tap(); openTreasurePage(kidById(ui.kidId), el.dataset.key); };
actions['dig-book-back'] = () => openDigBook(kidById(ui.kidId), ui.dgTab || 'skeletons', ui.dgScroll || 0);
actions['dig-show'] = (el) => {
  const kid = kidById(ui.kidId);
  if (!kid) return;
  const field = el.dataset.kind === 'stand' ? 'skeleton' : 'pedestal';
  kid.digShow = { ...(kid.digShow || {}), [field]: el.dataset.id || null };
  sounds.tap();
  save();
  render();
  openDisplayPicker(kid, el.dataset.kind);
};

actions['tank-pick'] = (el) => {
  ui.tankPick = el.dataset.species;
  $modal.querySelectorAll('.tp-fish').forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-pressed', String(b === el)); });
  const input = $modal.querySelector('#tank-name');
  if (input) input.placeholder = fishSpecies(ui.tankPick)?.name || '';
};
actions['tank-slot'] = (el) => {
  const kid = kidById(ui.kidId);
  const name = $modal.querySelector('#tank-name');
  openTankPicker(kid, Number(el.dataset.slot));
  name?.blur();
};
actions['tank-save'] = () => {
  const kid = kidById(ui.kidId);
  const name = $modal.querySelector('#tank-name')?.value;
  const tank = kid && ui.tankPick && putInTank(kid, ui.tankSlot || 0, ui.tankPick, name);
  if (!tank) return;
  kid.tank = tank;
  save();
  sounds.tap();
  const fish = tankSlots(kid)[ui.tankSlot || 0];
  toast(`🐟 ${fish?.nickname || fishSpecies(fish?.species)?.name || 'Your fish'} is in the tank!`);
  render();
  // a bigger tank with room left: on to the next empty place (if there's a fish to put there)
  const room = tankRoom(kid);
  const shown = tankFishes(kid, room);
  const caught = Object.keys(kid.fishRecords || {}).filter((id) => fishSpecies(id)).length;
  if (room > 1 && shown.length < room && caught > shown.length) openTankPicker(kid);
  else closeModal();
};
actions['tank-empty'] = () => {
  const kid = kidById(ui.kidId);
  if (!kid) return;
  const tank = takeFromTank(kid, ui.tankSlot || 0);
  if (tank) kid.tank = tank; else delete kid.tank;
  save();
  render();
  if (tankRoom(kid) > 1 && tank) openTankPicker(kid, ui.tankSlot || 0);
  else closeModal();
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
      <p class="muted small">Play a visitor game right away to see how it feels. Gear means the ball, stick, football, fishing rod, sled, bike, skis, camera, shovel or running shoes for that game. Nothing counts toward the daily limit or anyone's best.</p>
      <div class="game-test-pick">
        <label>Playing <select id="gt-kid">${opt(ui.gtKid || kids[0].id, who)}</select></label>
        <label>Their gear <select id="gt-kid-gear">${opt(ui.gtKidGear || '1', tiers)}</select></label>
        <label>Visitor <select id="gt-vis">${opt(ui.gtVis || (kids[1] || kids[0]).id, who)}</select></label>
        <label>Visitor's gear <select id="gt-vis-gear">${opt(ui.gtVisGear || '1', tiers)}</select></label>
        <label>Map (fishing, sledding, ski race, tag, photo train, trick jumps, dino dig) <select id="gt-map">${opt(ui.gtMap || kidTheme(kids[0]), Object.entries(FISH_SPOTS).map(([id, sp]) => [id, sp.name]))}</select></label>
        <label>Fishing boat <select id="gt-boat">${opt(ui.gtBoat || '0', [['0', 'No boat'], ['1', 'In the boat']])}</select></label>
        <label>Tag personality <select id="gt-pers">${opt(ui.gtPers || '', [['', 'Their buddy\'s own'], ...Object.entries(PERSONALITIES).map(([id, p]) => [id, p.name])])}</select></label>
      </div>
      <div class="row wrap">
        ${['soccer', 'tag', 'hockey', 'football', 'fishing', 'sledding', 'race', 'train', 'tricks', 'dig'].map((k) => `<button class="btn" data-action="game-test" data-kind="${k}">${GAME_NAMES[k]}</button>`).join('')}
      </div>
    </div>`;
}

// Settings > Try a season: a parent sees the villages and yards in another season on this device only.
const SEASON_ICONS = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
function seasonTestCard() {
  const real = seasonOf(today());
  let tried = null;
  try { tried = SEASONS.includes(localStorage.getItem('kidquest.season')) ? shownSeason(today()) : null; } catch { /* no storage */ }
  const btn = (id, label) => `<button class="btn ${id === (tried || 'real') ? '' : 'ghost'}" data-action="try-season" data-season="${id}" aria-pressed="${id === (tried || 'real')}">${label}</button>`;
  return `
    <div class="card season-test">
      <h2>🍂 Try a season</h2>
      <p class="muted small">See the villages and the garden in another season. It is the real season (${real}) unless you pick one here. This changes this device only, so it does not change anything on the kids' other devices.</p>
      <div class="row wrap">
        ${btn('real', 'Real')}${SEASONS.map((x) => btn(x, `${SEASON_ICONS[x]} ${x[0].toUpperCase()}${x.slice(1)}`)).join('')}
      </div>
    </div>`;
}
actions['try-season'] = (el) => {
  trySeason(el.dataset.season === 'real' ? null : el.dataset.season);
  sounds.tap();
  render();
};

actions['game-test'] = (el) => {
  const kind = el.dataset.kind;
  const val = (id) => document.getElementById(id)?.value;
  Object.assign(ui, { gtKid: val('gt-kid'), gtKidGear: val('gt-kid-gear'), gtVis: val('gt-vis'), gtVisGear: val('gt-vis-gear'), gtMap: val('gt-map'), gtBoat: val('gt-boat'), gtPers: val('gt-pers') });
  const kid = kidById(ui.gtKid) || state.kids[0];
  const other = kidById(ui.gtVis) || kid;
  const gearKind = kind === 'tag' ? 'shoes' : kind === 'fishing' ? 'rod' : kind === 'sledding' ? 'sled' : kind === 'race' ? 'skis' : kind === 'train' ? 'camera' : kind === 'tricks' ? 'bike' : kind === 'dig' ? 'shovel' : kind;
  const gear = (tier) => (Number(tier) ? { [gearKind]: Number(tier) } : {});
  // the same kid on both sides still needs two names
  const visName = other.id === kid.id ? 'Visitor' : other.name;
  sounds.tap();
  openPlay({
    kind,
    best: 0,
    kid: { buddy: kid.buddy, name: kid.name, gear: { ...gear(ui.gtKidGear), ...(kind === 'fishing' && ui.gtBoat === '1' ? { boat: 1 } : {}) }, moves: moveIds(mover(kid)) },
    visitor: { buddy: other.buddy, name: visName, gear: gear(ui.gtVisGear), moves: moveIds(mover(other)), personality: ui.gtPers || undefined },
    map: ui.gtMap || kidTheme(kid),
    day: today(),
    season: shownSeason(today()),
    sounds,
  });
};

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
  toast(`Exercise ${ex.goal || EXERCISE_DAYS} days in one week for a ⭐ strong week and your first move! 💪`);
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
  // unless a piano timer, the recording studio or the Note-o-Matic is on screen (then the next open picks it up).
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || ui.view === 'timer' || ui.view === 'watch' || ui.view === 'studio' || ui.view === 'lab' || ui.view === 'compose') return;
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
  charts: (el) => { const kid = kidById(el.dataset.kid); if (kid) openCharts(kid); },
  'chart-style': (el) => { ui.chartStyle = el.dataset.style; drawCharts(); },
  'chart-print': () => { window.print(); },
  'chart-close': () => { closeCharts(); render(); },
  'plan-print-ask': (el) => {
    const kid = kidById(el.dataset.kid);
    if (!kid) return;
    kid.chartWanted = true;
    save();
    toast('A grown-up will see it under Kids 🖨️');
  },
  'plan-nudge': (el) => {
    const kid = kidById(ui.planKid);
    if (!kid || !ui.planDraft) return;
    nudgeChore(kid, ui.planDraft, el.dataset.id, Number(el.dataset.dir));
    planModal(kid);
  },
  'plan-moving': (el) => {
    const kid = kidById(ui.planKid);
    if (!kid) return;
    ui.planMoving = ui.planMoving === el.dataset.id ? null : el.dataset.id;
    planModal(kid);
  },
  'plan-moveto': (el) => {
    const kid = kidById(ui.planKid);
    if (!kid || !ui.planDraft) return;
    moveChore(kid, ui.planDraft, el.dataset.id, el.dataset.routine);
    ui.planMoving = null;
    planModal(kid);
  },
  'plan-step': (el) => {
    const kid = kidById(ui.planKid);
    if (!kid) return;
    ui.planStep = Math.max(0, Math.min(planSteps(kid).length - 1, (ui.planStep || 0) + Number(el.dataset.dir)));
    ui.planMoving = null;
    planModal(kid);
    $modal.querySelector('.modal-card')?.scrollTo?.(0, 0);
  },
  'plan-day': (el) => {
    const kid = kidById(ui.planKid);
    const t = kid?.tasks.find((x) => x.id === el.dataset.id);
    if (!t || !ui.planDraft) return;
    toggleDay(ui.planDraft, t, Number(el.dataset.dow));
    planModal(kid);
  },
  'plan-grow': (el) => {
    const kid = kidById(ui.planKid);
    if (!kid || !ui.planDraft) return;
    if (!canGrow(kid, el.dataset.id, today())) return;
    ui.planDraft.grow = el.dataset.id;
    planModal(kid);
  },
  'plan-seed': (el) => {
    const kid = kidById(ui.planKid);
    if (!kid || !ui.planDraft) return;
    ui.planDraft.seed = el.dataset.id;
    sounds.tap();
    planModal(kid);
  },
  'plan-sign': (el) => {
    const kid = kidById(el.dataset.kid);
    const d = ui.planDraft;
    if (!kid || !d) return;
    const gift = signPlan(kid, d, today());
    save();
    ui.planDraft = null;
    closeModal();
    render();
    sounds.week();
    confetti(120, 2200);
    openModal(`
      <div class="celebrate">
        ${buddyHtml(kid, 'excited', 'xl')}
        <h1>That's my plan!</h1>
        ${gift ? `<p>🎁 A free packet of <b>${esc(gift.seed.name.toLowerCase())}</b>${gift.planted ? ' is planted in your garden. Each day you do your chore, it grows!' : ' is in your seed bag. Plant it in your garden!'}</p>` : ''}
        <div class="stack">
          <button class="btn huge" data-action="modal-close">Let's go!</button>
          <button class="btn ghost" data-action="plan-print-ask" data-kid="${kid.id}">🖨️ Ask a grown-up to print my chart</button>
        </div>
      </div>`);
  },
  // the HUD's family pill: the party once it's earned, otherwise how the family is doing
  'family-pill': () => {
    if (familyToday().happy) { startParty(); return; }
    const fam = familyText('village');
    sounds.tap();
    if (fam) toast(fam.text);
  },
  status: (el) => { sounds.tap(); openStatus(kidById(ui.kidId), el.dataset.tab || 'me'); },
  'status-tab': (el) => { sounds.tap(); openStatus(kidById(ui.kidId), el.dataset.tab); },
  // Change outfit: the shop when it's open, otherwise why it's shut (on the village, under the pop-up)
  'status-outfit': () => { closeModal(); actions.wardrobe(); },
  'status-scores': () => openLeaderboard(kidById(ui.kidId)),
  'status-fish': () => openFishBook(kidById(ui.kidId)),
  'status-skis': () => openSkiBook(kidById(ui.kidId)),
  'status-tricks': () => openTrickBook(kidById(ui.kidId)),
  'trick-book': () => openTrickBook(kidById(ui.kidId)),
  'trick-page': (el) => openTrickPage(kidById(ui.kidId), el.dataset.trick),
  'status-album': () => openCritterAlbum(kidById(ui.kidId)),
  menu: () => { sounds.tap(); openMenu(kidById(ui.kidId)); },
  'menu-music': () => {
    // music needs sounds: turning music on turns sounds on too
    const on = !(state.settings.sound && state.settings.music !== false);
    state.settings.music = on;
    if (on && !state.settings.sound) { state.settings.sound = true; setSound(true); }
    save(); render(); openMenu(kidById(ui.kidId));
  },
  'menu-sound': () => {
    state.settings.sound = !state.settings.sound;
    setSound(state.settings.sound);
    save(); render(); sounds.tap(); openMenu(kidById(ui.kidId));
  },
  'menu-switch': () => { closeModal(); actions.home(); },
  'menu-parents': () => { closeModal(); actions.parent(); },
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
  if (e.target.matches?.('[data-chartstickers]')) { ui.chartStickers = e.target.checked; drawCharts(); }
});

document.addEventListener('change', (e) => {
  const r = e.target.dataset?.planroutine;
  if (!r || !ui.planDraft) return;
  if (e.target.value) ui.planDraft.cues[r] = e.target.value; else delete ui.planDraft.cues[r];
  const kid = kidById(ui.planKid);
  if (kid) planModal(kid);
});

// Exposed for debugging in the browser console only.
window.kidQuest = { get state() { return state; }, save, get cloud() { return cloud; } };
