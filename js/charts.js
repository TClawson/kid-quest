// Printed chore charts made from the kid's own plan (Plan my week, planrules.js): one page per
// routine with a token spot for each chore, in the kid's order and with their start cue; a
// week grid for the big kids; and a sticker sheet with a face for each token. Pure logic, no
// DOM (the pages are drawn by chartsHtml in app.js with chartart.js's pictures).

import { routineOf, plannedTask, planOrder, routineCue, choreWords, isExercise, DAY_NAMES, weekStart } from './logic.js';

/** Tokens already on the sticker sheets keep their colors (robot-buddy charts). */
export const TOKEN_COLORS = {
  bed: '#3b7dd8', dressed: '#e8702a', teeth: '#1fa88a', 'teeth-night': '#33307a',
  clothes: '#7a4ab0', toys: '#d8443a', books: '#d89a2a',
};
const MORE_COLORS = ['#2b8a3e', '#c2255c', '#1971c2', '#e67700', '#5f3dc4', '#0c8599', '#a61e4d', '#5c940d'];

/** Which drawn chore a task is (for its picture and token color), or null. */
export function choreKind(task) {
  if (task.house === 'bed' || task.setKey === 'bed') return 'bed';
  if (task.house === 'teeth' || task.setKey === 'teeth') return 'teeth';
  if (task.house === 'teeth-night' || task.setKey === 'teeth-night') return 'teeth-night';
  for (const k of ['dressed', 'clothes', 'toys', 'books']) if (task.setKey === k) return k;
  const n = task.name.trim().toLowerCase();
  if (n === 'get dressed') return 'dressed';
  if (n === 'clothes away') return 'clothes';
  if (n === 'toys away') return 'toys';
  if (n === 'books away') return 'books';
  return null;
}

export const ROUTINE_PAGES = {
  morning: { title: 'Good morning', icon: '☀️' },
  afternoon: { title: 'After school', icon: '🎒' },
  evening: { title: 'Goodnight routine', icon: '🌙' },
};

/** Most tokens on one page (a longer routine goes on two pages). */
export const PER_PAGE = 4;

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** "Every day", "Mon–Fri", "Wed": which days a chore is on, short. */
export function daysShort(days) {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return '';
  if (set.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (set.join() === '0,6') return 'Weekends';
  return DAY_ORDER.filter((d) => set.includes(d)).map((d) => DAY_NAMES[d]).join(', ');
}

/**
 * The kid's chores as chart rows, routine by routine in their planned order: { routine,
 * cue, chores: [{ id, name, icon, kind, color, days, daysText, grow }] }. Bonus exercise the
 * kid planned goes last, in its own group, on the week grid only.
 */
export function chartRoutines(kid) {
  const tasks = planOrder(kid, (kid.tasks || []).map((t) => plannedTask(kid, t)));
  let extra = 0;
  const row = (t) => {
    const kind = choreKind(t);
    return {
      id: t.id, name: t.name, icon: t.icon, kind,
      color: TOKEN_COLORS[kind] || MORE_COLORS[(extra++) % MORE_COLORS.length],
      days: t.days, daysText: daysShort(t.days), grow: kid.plan?.grow === t.id && kid.plan?.week === kid.plan?.signed,
    };
  };
  const out = ['morning', 'afternoon', 'evening'].map((r) => {
    const list = tasks.filter((t) => !isExercise(t) && routineOf(t) === r);
    const words = list.map(choreWords);
    const said = words.length > 1 ? `${words.slice(0, -1).join(', ')}, then ${words[words.length - 1]}` : words[0] || '';
    const cue = list[0] ? routineCue(kid, list[0]) : '';
    return { routine: r, cue, sentence: said ? `${cue ? `${cue}, I'll` : "I'll"} ${said}.` : '', chores: list.map(row) };
  }).filter((g) => g.chores.length);
  const ex = tasks.filter(isExercise);
  if (ex.length) out.push({ routine: 'exercise', cue: '', sentence: '', chores: ex.map(row) });
  return out;
}

/** Token pages for a little kid: [{ routine, part, parts, title, sentence, chores }], up to PER_PAGE chores each. */
export function tokenPages(kid) {
  const pages = [];
  for (const g of chartRoutines(kid).filter((x) => x.routine !== 'exercise')) {
    const parts = Math.ceil(g.chores.length / PER_PAGE);
    for (let i = 0; i < parts; i += 1) {
      pages.push({
        routine: g.routine, part: i + 1, parts,
        title: ROUTINE_PAGES[g.routine].title, sentence: g.sentence,
        chores: g.chores.slice(i * PER_PAGE, (i + 1) * PER_PAGE).map((c, j) => ({ ...c, n: i * PER_PAGE + j + 1 })),
      });
    }
  }
  return pages;
}

/** Every token the kid's pages use (one per chore), for the sticker sheet. */
export const stickers = (kid) => tokenPages(kid).flatMap((p) => p.chores);

/** The style a kid's chart prints in by default: tokens for the Little set, a week grid for the Big. */
export const defaultStyle = (kid) => (kid.choreSet === 'big' ? 'grid' : 'tokens');

/**
 * A fingerprint of what the printed chart shows (order, routines, days, cues, grow), so the
 * app can say when the chart on the wall no longer matches the kid's plan.
 */
export function chartSignature(kid) {
  return JSON.stringify(chartRoutines(kid).map((g) => [g.routine, g.cue, g.chores.map((c) => [c.id, c.name, c.days.join(''), c.grow ? 1 : 0])]));
}

/** Whether the kid's chart needs printing again: never printed, or printed before the plan changed. */
export const chartOutdated = (kid) => Boolean(kid.plan?.signed) && kid.chartPrinted !== chartSignature(kid);

export { DAY_ORDER, weekStart };
