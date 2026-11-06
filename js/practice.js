// Practice timer rules. The timer counts from clock times, not from ticks, so it
// stays right when the app is in the background (for example while a kid uses
// Note Rush) or when Android closes the app and it opens again.

import { parseKey, addDays } from './logic.js';

/** When a day ends (local midnight), in ms. Practice time never carries into the next day. */
export function dayEnd(key) {
  return parseKey(addDays(key, 1)).getTime();
}

/**
 * Seconds practiced so far in a run.
 * run: { day, since (ms when this run started), base (seconds already done before it) }
 * total: the timer length in seconds.
 */
export function runSeconds(run, now, total) {
  const end = Math.min(now, dayEnd(run.day));
  const gained = Math.max(0, Math.floor((end - run.since) / 1000));
  return Math.min(total, (run.base || 0) + gained);
}

// What the buddy on the timer page says when tapped. Preset lines only.
export const CHEERS = [
  () => 'You sound great! 🎶',
  (n) => `Keep going, ${n}! 💪`,
  () => 'Every note makes you better! 🎹',
  () => 'I love this song! 💛',
  () => 'Slow and steady wins! 🐢',
  () => 'Mistakes help you learn! 🌱',
  () => 'Your fingers are getting faster! ⚡',
  () => 'Try that tricky part once more! 🔁',
  () => 'Rock star in training! 🎸',
  (n) => `So proud of you, ${n}! 🌟`,
  () => 'You’re on fire today! 🔥',
  () => 'Encore! Encore! 👏',
];

/** A random cheer index that isn't the last one shown. */
export function pickCheer(last, rnd = Math.random) {
  const options = CHEERS.map((_, i) => i).filter((i) => i !== last);
  return options[Math.floor(rnd() * options.length)];
}

/**
 * Cheers that name what the kid has really done, rather than general praise:
 * praise for effort and progress keeps kids trying, more than "you're great".
 * facts: { name, pianoStreak, pianoWeek, minutesWeek, pianoHabit: { done, goal, mastered } | null, month: { done, days } }
 */
export function effortCheers(facts) {
  const out = [];
  const { pianoStreak = 0, pianoWeek = 0, minutesWeek = 0, pianoHabit = null, month = null } = facts || {};
  if (pianoStreak >= 2) out.push(`${pianoStreak} piano days in a row! Your practice is paying off 🎹`);
  if (pianoWeek >= 2) out.push(`This is piano day ${pianoWeek} this week. You keep showing up! 💪`);
  if (minutesWeek >= 20) out.push(`${minutesWeek} minutes of piano this week. Those minutes add up! ⏱️`);
  if (pianoHabit?.mastered) out.push('Piano is a mastered habit for you now ⭐');
  else if (pianoHabit && pianoHabit.done >= pianoHabit.goal / 2) out.push(`${pianoHabit.done} of ${pianoHabit.goal} toward your piano habit star ⭐`);
  if (month && month.days >= 5 && month.done / month.days >= 0.7) out.push(`${month.done} of ${month.days} days done this month. You're building something! 🧱`);
  return out;
}
