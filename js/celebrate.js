// Celebrations: the end-of-day and weekly celebrations, new unlocks, habit
// stars, the weekly look back, new moves and Saturday's free games (split out
// of app.js; shared things come from ctx.js).
import {
  storeOpen, streakInfo, weeklyRewardInfo, habitInfo, weekStart, weekLookback, planOrder,
  freeGamesOn, SATURDAY_GAMES, COMEBACK_BONUS,
} from './logic.js';
import { sounds, confetti } from './fx.js';
import { buddySvg } from './avatar.js';
import { itemById, newUnlocks, unlockedMoves } from './items.js';
import { prizeText } from './treasure.js';
import { chestSvg } from './treasure-art.js';
import { effortNote } from './timer-ui.js';
import {
  state, $modal, today, esc, save, openModal, currentKid, dressed, buddyHtml, progressFor, mover, doMove,
} from './ctx.js';

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
export function showUnlocks(kid) {
  if (!$modal.hidden) return false;
  if (showMastered(kid)) return true;
  if (showLookback(kid)) return true;
  if (showNewMoves(kid)) return true;
  const ids = newUnlocks(kid, progressFor(kid));
  if (!ids.length) return false;
  kid.seenUnlocks = [...(kid.seenUnlocks || []), ...ids];
  kid.newItems = [...(kid.newItems || []), ...ids];
  save();
  const items = ids.map(itemById);
  const preview = { ...dressed(kid), outfit: { ...kid.buddy.outfit, [items[0].slot]: items[0].id } };
  sounds.day();
  confetti(120, 2400);
  openModal(`
    <div class="celebrate">
      <div class="buddy buddy-xl mood-excited">${buddySvg(preview, 'excited')}</div>
      <h1>New stuff unlocked!</h1>
      <p>${items.map((i) => `<b>${esc(i.name)}</b>`).join(', ')}</p>
      <div class="stack">
        ${storeOpen(state, kid, today()).open
          ? `<button class="btn huge" data-action="unlock-try" data-slot="${items[0].slot}">Try it on!</button>
        <button class="btn ghost" data-action="modal-close">Later</button>`
          : `<p class="muted">Try it on once today's chores are done.</p>
        <button class="btn huge" data-action="modal-close">OK</button>`}
      </div>
    </div>`);
  return true;
}

/** The key a habit star is remembered by once celebrated: the task id for the first, then id#2, id#3… */
const starKey = (h, n) => (n === 1 ? h.task.id : `${h.task.id}#${n}`);

/** A habit star the kid just earned (see habitInfo): celebrated once each. */
function showMastered(kid) {
  const seen = new Set(kid.seenMastered || []);
  const fresh = [...habitInfo(state, kid, today()).values()].filter((h) => h.stars.some((_, i) => !seen.has(starKey(h, i + 1))));
  if (!fresh.length) return false;
  kid.seenMastered = [...seen, ...fresh.flatMap((h) => h.stars.map((_, i) => starKey(h, i + 1)))];
  const again = fresh.every((h) => h.stars.length > 1);
  save();
  sounds.week();
  confetti(200, 3200);
  openModal(`
    <div class="celebrate">
      ${buddyHtml(kid, 'proud', 'xl')}
      <div class="celebrate-emoji small">⭐</div>
      <h1>${again ? 'Another habit star!' : 'Habit mastered!'}</h1>
      <p>${fresh.map((h) => `${esc(h.task.icon)} <b>${esc(h.task.name)}</b> ${'⭐'.repeat(Math.min(5, h.stars.length))}`).join(', ')}</p>
      <p>${again ? 'You kept it up for another two months. It really is part of who you are!' : `You did ${fresh.length > 1 ? 'these' : 'it'} on almost every day for two months. That's not a chore anymore, it's part of who you are!`}</p>
      <p class="muted small">Stars stay for good, and every 60 days you keep it up earns another. Your weekly coins stay the same: from Monday more of them come from the habits you're still building.</p>
      <button class="btn huge" data-action="modal-close">Awesome!</button>
    </div>`, () => setTimeout(() => showUnlocks(currentKid(kid)), 250));
  return true;
}

/** Once a week: how last week went, task by task, next to four weeks before. Then plan the new week. */
function showLookback(kid) {
  const t = today();
  const monday = weekStart(t);
  if (kid.lookbackSeen === monday) return false;
  const lb = weekLookback(state, kid, t);
  // only once there is a real week to look back on (a kid who used the app last week)
  if (lb.days < 4 || !lb.tasks.some((r) => r.done > 0)) return false;
  kid.lookbackSeen = monday;
  save();
  const rows = planOrder(kid, lb.tasks.map((r) => r.task)).map((task) => lb.tasks.find((r) => r.task.id === task.id)).map((r) => {
    const b = r.before;
    const better = b && r.done / r.of > b.done / b.of;
    return `<div class="look-row ${better ? 'better' : ''}"><span>${esc(r.task.icon)} ${esc(r.task.name)}</span><b>${r.done} of ${r.of}</b>${b ? `<small>${better ? '⬆ ' : ''}4 weeks ago: ${b.done} of ${b.of}</small>` : ''}</div>`;
  }).join('');
  const ups = lb.tasks.filter((r) => r.before && r.done / r.of > r.before.done / r.before.of);
  const lead = ups.length
    ? `You got better at ${ups.length === 1 ? esc(ups[0].task.name.toLowerCase()) : `${ups.length} things`} since a month ago. Your practice is working!`
    : `You finished every task on ${lb.daysDone} of ${lb.days} days.`;
  openModal(`
    <div class="lookback">
      <h1>📅 Last week</h1>
      <p>${lead}</p>
      <div class="look-rows">${rows}</div>
      <div class="stack">
        <button class="btn huge" data-action="plan" data-kid="${kid.id}">📝 Plan this week</button>
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
      <p class="muted small">Best: ${who.exBest} strong ${who.exBest === 1 ? 'week' : 'weeks'} in a row 💪 Tap your buddy anytime to see a move.</p>
      <button class="btn huge" data-action="modal-close">Awesome!</button>
    </div>`, () => setTimeout(() => showUnlocks(currentKid(kid)), 250));
  setTimeout(() => { const el = $modal.querySelector('.buddy-tap'); if (el) doMove(el, who, first.move.id); }, 500);
  return true;
}

/** Saturday morning: two free games pop up like a chest prize. */
function showSaturdayGames(kid, onClose) {
  const words = prizeText({ kind: 'games', games: SATURDAY_GAMES });
  sounds.tap();
  openModal(`
    <div class="celebrate chest-card chest-wood">
      <div class="chest-shake">${chestSvg('wood', false, 7)}</div>
      <div class="chest-reveal">
        <div class="chest-behind">${chestSvg('wood', true, 5)}</div>
        <div class="prize-art"><div class="prize-emoji">⚽</div></div>
        <h1>Saturday: ${esc(words.title.replace(/^(\d+) extra/, '$1 free'))}</h1>
        <p>${esc(words.text)}</p>
        <button class="btn huge" data-action="modal-close">Awesome!</button>
      </div>
    </div>`, onClose);
  setTimeout(() => { sounds.day(); confetti(90, 2200); }, 1000);
}

export function celebrateIfDue(kid) {
  const t = today();
  const sat = state.celebrations[kid.id];
  if (freeGamesOn(t) && sat?.sat !== t && $modal.hidden) {
    state.celebrations[kid.id] = { ...(sat || {}), sat: t };
    save();
    return showSaturdayGames(kid, () => setTimeout(() => celebrateIfDue(currentKid(kid)), 250));
  }
  const info = streakInfo(state, kid, t);
  const after = () => setTimeout(() => showUnlocks(currentKid(kid)), 250);
  const seen = state.celebrations[kid.id];
  // the weekly reward shows once a week, as soon as it is earned: on Friday, or
  // later in the weekend if a parent approves a day's chores late
  const reward = state.settings.weeklyReward?.trim() ? weeklyRewardInfo(state, kid, t) : null;
  const rewardNew = Boolean(reward?.earned && seen?.reward !== reward.monday);
  const dayNew = info.todayComplete && seen?.day !== t;
  if (!rewardNew && !dayNew) return showUnlocks(kid);
  const next = { ...(seen || {}) };
  if (info.todayComplete) { next.day = t; next.streak = info.streak; }
  if (rewardNew) next.reward = reward.monday;
  state.celebrations[kid.id] = next;
  save();
  if (rewardNew) {
    celebrate({
      kid,
      onClose: after,
      emoji: '🏆',
      title: 'WEEKLY REWARD!',
      text: `You did every chore Monday to Friday! Your reward: ${state.settings.weeklyReward}. Show a parent!${dayNew ? ' Then tap your treasure chest!' : ''}`,
      sound: sounds.week,
      big: true,
    });
  } else if (info.inARow > 0 && info.inARow % 7 === 0) {
    const weeks = info.inARow / 7;
    celebrate({
      kid,
      onClose: after,
      emoji: '🔥',
      title: weeks === 1 ? 'A WHOLE WEEK!' : `${weeks} WEEKS IN A ROW!`,
      text: `${info.inARow} days in a row!${info.freezes ? ' You have a streak freeze ❄️ saved up.' : ''} Tap your treasure chest!`,
      sound: sounds.week,
      big: true,
    });
  } else if (info.comebacks.includes(t)) {
    celebrate({
      kid,
      onClose: after,
      emoji: '💪',
      title: 'Welcome back!',
      text: `You bounced back after a missed day. That's how habits are built! +${COMEBACK_BONUS} 🪙 bonus. Your streak is ${info.streak} ${info.streak === 1 ? 'day' : 'days'} 🔥 Tap the treasure chest to open it!`,
      sound: sounds.day,
    });
  } else {
    celebrate({
      kid,
      onClose: after,
      emoji: '🌟',
      title: 'Quest complete!',
      text: `Everything is done for today. Your streak is now ${info.streak} ${info.streak === 1 ? 'day' : 'days'} 🔥 ${effortNote(kid)} Tap the treasure chest to open it!`,
      sound: sounds.day,
    });
  }
  return true;
}

