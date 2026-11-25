// Plan my week: the kid's own plan, made once a week (after Monday's look-back) or any time.
// Parents set the chores; the kid decides, for the chores a parent hasn't pinned or fixed:
// - which routine each one is in (morning, after school, evening) and the order inside it
// - the moment that starts each routine ("After snack")
// - the days of the chores a parent marked "kid picks the days" (task.kidDays a week)
// - one chore to grow this week, which comes with a free one-week flower seed packet
// Saved on kid.plan = { order, routines, cues, days, grow, signed, seedWeek, seed, seedTask, week }.
// kid.grown = the chores that have had their grow week this round (growTurns).
// Pure logic, no DOM (the screens are planModal in app.js). logic.js applies the plan to
// the schedule (plannedTask).

import { weekStart, isExercise, isPinned, routineOf, plannedTask, planOrder, CUES } from './logic.js';
import { SEEDS, seedById, gardenOf, plant, plantableTasks } from './gardenrules.js';

export const ROUTINES = [
  { id: 'morning', name: 'Morning', icon: '☀️' },
  { id: 'afternoon', name: 'After school', icon: '🎒' },
  { id: 'evening', name: 'Evening', icon: '🌙' },
];

/** The one-week flowers a kid can pick their free packet from. */
export const FREE_SEEDS = SEEDS.filter((s) => s.kind === 'flower');

/** The chores a kid plans (everything but bonus exercise), in the kid's order. */
const choresOf = (kid) => (kid.tasks || []).filter((t) => !isExercise(t));

/** A fresh draft of the kid's plan, from what they planned before (or the parents' setup). */
export function planDraft(kid, today) {
  const p = kid.plan || {};
  const chores = choresOf(kid);
  const routines = {};
  for (const t of chores) routines[t.id] = routineOf(plannedTask(kid, t));
  const days = {};
  for (const t of flexTasks(kid)) days[t.id] = [...plannedTask(kid, t).days];
  const cues = {};
  for (const r of ROUTINES) {
    const c = p.cues?.[r.id];
    if (c && CUES[r.id].includes(c)) cues[r.id] = c;
  }
  // an older plan had a cue per chore: the first chore's cue starts its routine
  if (!Object.keys(cues).length && p.cues) {
    for (const t of planOrder(kid, chores)) {
      const r = routines[t.id]; const c = p.cues[t.id];
      if (!cues[r] && c && CUES[r]?.includes(c)) cues[r] = c;
    }
  }
  return {
    order: planOrder(kid, kid.tasks || []).map((t) => t.id),
    routines,
    cues,
    days,
    grow: p.week === weekStart(today) ? p.grow || null : null,
    seed: null,
  };
}

/** A routine's chores in the draft, in order: [task] with .pinned. */
export function routineList(kid, draft, routine) {
  const byId = new Map(choresOf(kid).map((t) => [t.id, t]));
  const ids = [...draft.order.filter((id) => byId.has(id)), ...[...byId.keys()].filter((id) => !draft.order.includes(id))];
  return ids.map((id) => byId.get(id)).filter((t) => (draft.routines[t.id] || routineOf(t)) === routine);
}

/**
 * Move a chore in the draft: into a routine, before the chore `beforeId` (or at the end of the
 * routine). A pinned chore can only move inside its own routine. Returns false if it can't move.
 */
export function moveChore(kid, draft, id, routine, beforeId = null) {
  const t = choresOf(kid).find((x) => x.id === id);
  if (!t || !ROUTINES.some((r) => r.id === routine)) return false;
  const from = draft.routines[id] || routineOf(t);
  if (from !== routine && isPinned(t)) return false;
  draft.routines[id] = routine;
  const order = draft.order.filter((x) => x !== id);
  let at;
  if (beforeId && beforeId !== id && order.includes(beforeId)) at = order.indexOf(beforeId);
  else {
    // after the last chore of that routine (or of an earlier routine), so routines stay together
    const rank = ROUTINES.findIndex((r) => r.id === routine);
    at = 0;
    order.forEach((x, i) => {
      const o = choresOf(kid).find((c) => c.id === x);
      if (!o) return;
      const r = ROUTINES.findIndex((rr) => rr.id === (draft.routines[x] || routineOf(o)));
      if (r <= rank) at = i + 1;
    });
  }
  order.splice(at, 0, id);
  draft.order = order;
  return true;
}

/** Move a chore one step up or down inside its routine. */
export function nudgeChore(kid, draft, id, dir) {
  const t = choresOf(kid).find((x) => x.id === id);
  if (!t) return false;
  const list = routineList(kid, draft, draft.routines[id] || routineOf(t)).map((x) => x.id);
  const i = list.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  return moveChore(kid, draft, id, draft.routines[id] || routineOf(t), dir < 0 ? list[j] : list[j + 1] || null);
}

/** Chores whose days the kid picks: task.kidDays days a week (bonus exercise too). */
export const flexTasks = (kid) => (kid.tasks || []).filter((t) => t.kidDays > 0);

/** How the kid's picked days for a chore stand: { picked, need, ok }. Exercise needs at least its count. */
export function dayCheck(draft, task) {
  const picked = (draft.days[task.id] || []).length;
  const need = task.kidDays;
  return { picked, need, ok: isExercise(task) ? picked >= need : picked === need };
}

/** Turn a weekday on or off for a flexible chore. */
export function toggleDay(draft, task, dow) {
  const d = new Set(draft.days[task.id] || []);
  if (d.has(dow)) d.delete(dow); else d.add(dow);
  draft.days[task.id] = [...d].sort((a, b) => a - b);
}

/** Chores the kid can pick to grow this week (the quest chores, and exercise). */
export const growable = (kid) => (kid.tasks || []);

/**
 * Chores take turns growing: kid.grown lists the chores that have had a seed week in this
 * round. A chore can't be picked again until every other chore has had its week, then a new
 * round starts. Returns the ids still waiting for their turn this round (all of them when the
 * round is over).
 */
export function growTurns(kid) {
  const ids = growable(kid).map((t) => t.id);
  const left = ids.filter((id) => !(kid.grown || []).includes(id));
  return new Set(left.length ? left : ids);
}

/** Whether the kid may pick a chore to grow: its turn hasn't come yet this round. Once this week's seed is given, only its chore. */
export function canGrow(kid, id, today) {
  if (kid.plan?.seedWeek === weekStart(today)) return (kid.plan.seedTask || kid.plan.grow) === id;
  return growTurns(kid).has(id);
}

/**
 * Save the draft as the kid's plan and sign it for this week. The first time a week is
 * signed with a seed picked, the kid gets that free packet; it's planted straight away for the
 * grow chore in the first free bed (else it waits in their seed bag). Returns
 * { seed, planted } when a packet was given, else null.
 */
export function signPlan(kid, draft, today) {
  const monday = weekStart(today);
  const old = kid.plan || {};
  kid.plan = {
    order: draft.order,
    routines: draft.routines,
    cues: draft.cues,
    days: draft.days,
    grow: draft.grow || null,
    signed: monday,
    week: monday,
    ...(old.seedWeek ? { seedWeek: old.seedWeek, seed: old.seed, ...(old.seedTask ? { seedTask: old.seedTask } : {}) } : {}),
  };
  // this week's seed is already planted for its chore, so that stays the grow chore
  if (old.seedWeek === monday) kid.plan.grow = old.seedTask || old.grow || null;
  // a chore that already had its turn this round can't be the grow chore again yet
  else if (kid.plan.grow && !canGrow(kid, kid.plan.grow, today)) kid.plan.grow = null;
  if (!kid.plan.grow || !draft.seed || old.seedWeek === monday) return null;
  const seed = seedById(draft.seed);
  if (!seed || seed.kind !== 'flower') return null;
  const g = gardenOf(kid);
  g.seeds[seed.id] = (g.seeds[seed.id] || 0) + 1;
  kid.garden = g;
  kid.plan.seedWeek = monday;
  kid.plan.seed = seed.id;
  kid.plan.seedTask = draft.grow;
  // its turn is taken; once every chore has had one, a new round starts with this one
  const turns = growTurns(kid);
  kid.grown = turns.size === growable(kid).length ? [] : (kid.grown || []).filter((id) => growable(kid).some((t) => t.id === id));
  kid.grown.push(draft.grow);
  let planted = false;
  if (plantableTasks(kid).some((t) => t.id === draft.grow)) {
    const free = g.beds.findIndex((b) => !b);
    if (free >= 0) planted = !plant(kid, 'beds', free, seed.id, draft.grow, today);
  }
  return { seed, planted };
}

/** Whether the kid has signed a plan this week. */
export const signedThisWeek = (kid, today) => kid.plan?.signed === weekStart(today);

/** The free seed already given this week, or null. */
export const seedThisWeek = (kid, today) => (kid.plan?.seedWeek === weekStart(today) ? seedById(kid.plan.seed) : null);
