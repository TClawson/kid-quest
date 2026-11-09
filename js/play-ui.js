// Playing with a visitor: which games there are, how many are left today, the
// game picker, and starting a game (split out of app.js; shared things come
// from ctx.js).
import {
  entryFor, addDays, dayStatus, gamesLeft, carriedGames, freeGamesOn, earlyGames,
  logGame, lendLeft, logLend, gamesPerDay, GAMES_PER_DAY, OLD_GAMES_PER_DAY,
} from './logic.js';
import { sounds } from './fx.js';
import { itemById, unlockedMoves, bestGear } from './items.js';
import { planVisits } from './visits.js';
import { gameFor, GAME_NAMES } from './play.js';
import { openPlay } from './playground.js';
import { recordWeekBest } from './leaderboard.js';
import { recordCatch, catchSpecies } from './fishbook.js';
import {
  state, today, esc, save, render, openModal, currentKid, mover, exerciseInfo, kidTheme,
} from './ctx.js';

// ---------- playing with a visitor ----------
// What there is to play with a visitor: the game for the ball or stick the
// kid's buddy is holding, the visitor's own game (the one on their field, or a
// ball game they own, the same one all day), and always tag. More than one
// and the kid picks. Best scores live on the kid (kid.playBest). A kid gets
// gamesLeft() games a day: 4, plus 2 a week of the current exercise streak (up to 3 weeks).
const PLAY_KINDS = ['soccer', 'hockey', 'football'];
const GEAR_WORD = { soccer: 'ball', hockey: 'stick', football: 'football', fishing: 'rod' };
// the gear a game needs (the key in bestGear) and what a visitor calls it when lending it
const GEAR_KEY = { soccer: 'soccer', hockey: 'hockey', football: 'football', fishing: 'rod' };
const GEAR_NAME = { soccer: 'soccer ball', hockey: 'hockey stick', football: 'football', fishing: 'fishing rod' };
/** True when the kid would play with the visitor's gear: they don't own that kind. */
const borrows = (kid, kind) => !!GEAR_KEY[kind] && !(bestGear(kid.owned || [])[GEAR_KEY[kind]] > 0);
/** The buddy move ids a kid (or a visitor: { owned, exBest }) has unlocked, for game celebrations. */
export const moveIds = (who) => unlockedMoves(who.owned || [], who.exBest || 0).map((m) => m.move.id);
const visitGame = (v) => gameFor(bestGear(v.owned), `${today()}|${v.id}`);
// Chest games keep until the end of the next day (carriedGames).
// Saturday also brings free games, which are not tied to the chest.
const chestGames = (kid, day) => (entryFor(state, kid.id, day)?.chest?.games || 0) + freeGamesOn(day);
// A log with no cap is from before the limit dropped from 8 to 4, so yesterday's daily games were 8 (plus exercise).
const carriedFor = (kid) => carriedGames(kid, today(), chestGames(kid, addDays(today(), -1)), gamesPerDay(exerciseInfo(kid).weeks) + OLD_GAMES_PER_DAY - GAMES_PER_DAY);
export const gamesLeftFor = (kid) => gamesLeft(kid, today(), exerciseInfo(kid).weeks, chestGames(kid, today()) + carriedFor(kid));
// Before today's chores are done, only last night's carried chest games can be played.
export const playableFor = (kid, complete = dayStatus(state, kid, today(), today()).complete) =>
  complete ? gamesLeftFor(kid) : Math.min(gamesLeftFor(kid), earlyGames(kid, today(), carriedFor(kid)));

/** The game the kid's buddy is holding a ball or stick for, if any. */
function heldGame(kid) {
  const item = itemById(kid.buddy?.outfit?.sport);
  return item && PLAY_KINDS.includes(item.kind) ? item.kind : null;
}

/** Who does what on the kid's map today (see planVisits): the kid's held gear gets its own field. */
export function visitPlan(kid, visitors) {
  return planVisits(kid.id, visitors.map((v) => ({ id: v.id, gear: bestGear(v.owned) })), today(), heldGame(kid));
}

/** Fishing when the kid's buddy is holding a fishing rod (there's no field for it: the lake is in the game). */
function heldRod(kid) {
  return itemById(kid.buddy?.outfit?.sport)?.kind === 'rod' ? 'fishing' : null;
}

export function gamesWith(kid, v, plan) {
  const area = plan.areas.find((a) => a.members.includes(v.id));
  // a visitor fishing at the village pond goes fishing with you
  const theirs = area && PLAY_KINDS.includes(area.kind) ? area.kind : area?.kind === 'pond' ? 'fishing' : visitGame(v);
  // a visitor only lends their gear for a couple of games a day
  const lent = borrows(kid, theirs) && lendLeft(kid, today(), GEAR_KEY[theirs]) === 0 ? null : theirs;
  return [...new Set([heldGame(kid) || heldRod(kid), lent, 'tag'].filter(Boolean))];
}

export function pickGame(kid, v, games) {
  const held = heldGame(kid) || heldRod(kid);
  const note = (k) => (k === 'tag' ? 'No gear needed' : k === held ? `With your ${GEAR_WORD[k]}` : `With ${esc(v.name)}'s ${GEAR_WORD[k]}`);
  const lend = games.find((k) => k !== held && borrows(kid, k));
  const invite = lend
    ? `<p class="visitor-invite">${esc(v.name)}: "Do you want to play? I brought my ${GEAR_NAME[lend]}! I'll share with you for a couple of games so you can try it!"</p>`
    : '';
  openModal(`
    <h2>Play with ${esc(v.name)}</h2>
    ${invite}
    <div class="game-pick">
      ${games.map((k) => `<button class="btn" data-action="play-pick" data-kind="${k}" data-id="${esc(v.id)}" data-host="${esc(kid.id)}">${GAME_NAMES[k]}<small>${note(k)}</small></button>`).join('')}
    </div>
    <button class="btn ghost" data-action="modal-close">Not now</button>`);
}

export function playWith(kid, v, kind) {
  const kid0 = kid; // callbacks run later: look the kid up again each time
  const gear = bestGear(v.owned);
  const best = kid.playBest?.[kind] || 0;
  openPlay({
    kind,
    best,
    kid: { buddy: kid.buddy, name: kid.name, gear: bestGear(kid.owned || []), moves: moveIds(mover(kid)) },
    visitor: { buddy: v.buddy, name: v.name, gear, moves: moveIds(v) },
    map: kidTheme(kid),
    day: today(),
    sounds,
    gamesLeft: () => playableFor(currentKid(kid0)),
    onStart: () => {
      const kid = currentKid(kid0);
      if (borrows(kid, kind)) kid.lendLog = logLend(kid, today(), GEAR_KEY[kind]);
      kid.playLog = logGame(kid, today(), gamesPerDay(exerciseInfo(kid).weeks) + carriedFor(kid));
      save();
    },
    // the map's bubbles change when the games run out
    onClose: () => render(),
    onScore: (score) => {
      const kid = currentKid(kid0);
      kid.playBest = { ...(kid.playBest || {}), [kind]: score };
      save();
    },
    // every game's score counts toward this week's family chart (the chart on the house wall)
    onOver: (score) => {
      const kid = currentKid(kid0);
      const week = recordWeekBest(kid, kind, score, today());
      if (week !== kid.gameBests) { kid.gameBests = week; save(); }
    },
    // fishing: the biggest of each kind of fish goes in the fish book (in the house)
    onCatch: (c) => {
      const kid = currentKid(kid0);
      const sp = catchSpecies(c.map, c.kind);
      const got = sp && recordCatch(kid.fishRecords, { species: sp.id, size: c.size, points: c.points, date: today() });
      if (!got?.isNew) return null;
      kid.fishRecords = got.records;
      save();
      return got.first ? 'first' : 'record';
    },
  });
}

