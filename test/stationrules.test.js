// The buddy station's tap rules (js/stationrules.js): one test for each row of the tap table in
// the build plan, the five-second rule, the 20-second minimum, token links, and the write plan
// (one tap sends only that chore's record; one link sends only that token's field).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPEAT_MS, MIN_MS, defaultSong, linkable, findToken, tokensFor, linkToken, unlinkToken, setSong,
  freshTap, inPlayFrom, decideTap, finishRecord, songProgress, songLead, endPart, tookText, tokenNote,
} from '../js/stationrules.js';
import { emptyState, applyTaskChange } from '../js/logic.js';
import { splitState, diffDocs, planWrites, migrate } from '../js/store.js';

const T0 = 1_800_000_000_000;
const bed = { id: 't_bed', name: 'Make your bed', verify: 'self' };
const dishes = { id: 't_dish', name: 'Unload dishes', verify: 'parent' };
const piano = { id: 't_piano', name: 'Piano practice', verify: 'parent', minutes: 30 };
const kid = (id, tokens) => ({ id, name: id, tasks: [bed, dishes, piano], ...(tokens ? { tokens } : {}) });

// a tap where everything is ordinary unless the test says otherwise
const tap = (over = {}) => decideTap({
  fresh: true,
  found: { kid: kid('a'), link: { task: 't_bed', song: 60 } },
  onToday: true,
  record: null,
  playing: null,
  task: bed,
  now: T0,
  ...over,
});

test('song lengths start at 1 minute for the bed and 2 for everything else; timer chores take no token', () => {
  assert.equal(defaultSong(bed), 60);
  assert.equal(defaultSong({ name: 'Brush teeth' }), 120);
  assert.equal(defaultSong({ name: 'Bedroom tidy' }), 120, 'only the word bed');
  assert.equal(defaultSong(dishes), 120);
  assert.equal(linkable(bed), true);
  assert.equal(linkable(piano), false);
});

test('the five-second rule: a token resting on the phone, read every second, never counts again', () => {
  const reads = new Map();
  assert.equal(freshTap(reads, 's1', T0), true, 'first read');
  for (let i = 1; i <= 60; i += 1) assert.equal(freshTap(reads, 's1', T0 + i * 1000), false, `resting read ${i}`);
  // lifted for five seconds and tapped again: a new tap
  assert.equal(freshTap(reads, 's1', T0 + 60_000 + REPEAT_MS), true);
  assert.equal(freshTap(reads, 's1', T0 + 60_000 + REPEAT_MS + 4999), false);
  // another token is its own
  assert.equal(freshTap(reads, 's2', T0 + 60_001), true);
});

test('row: a repeat reading does nothing', () => {
  assert.deepEqual(tap({ fresh: false }), { kind: 'ignore' });
});

test('row: first tap of a token starts the chore and saves only startedAt', () => {
  assert.deepEqual(tap(), { kind: 'start', save: { startedAt: T0 } });
});

test('row: second tap too soon (under 20 seconds) is a small wave', () => {
  const playing = { serial: 's1', task: 't_bed', startedAt: T0, song: 60 };
  assert.deepEqual(tap({ playing, now: T0 + MIN_MS - 1 }), { kind: 'wave', reason: 'soon' });
});

test('row: second tap after 20 seconds checks it off, done for a chore the kid checks', () => {
  const playing = { serial: 's1', task: 't_bed', startedAt: T0, song: 60 };
  const r = tap({ playing, now: T0 + MIN_MS });
  assert.equal(r.kind, 'finish');
  assert.equal(r.took, MIN_MS);
  assert.deepEqual(r.save, { status: 'done', at: T0 + MIN_MS, by: 'token', took: MIN_MS });
});

test('row: a chore a parent checks goes to waiting for a parent', () => {
  const playing = { serial: 's2', task: 't_dish', startedAt: T0, song: 120 };
  const r = tap({ found: { kid: kid('a'), link: { task: 't_dish', song: 120 } }, task: dishes, playing, now: T0 + 90_000 });
  assert.deepEqual(r.save, { status: 'pending', at: T0 + 90_000, by: 'token', took: 90_000 });
  assert.deepEqual(finishRecord({ verify: 'self' }, 5), { status: 'done', at: 5, by: 'token' });
});

test('row: the song ended with no second tap; a second tap later still counts', () => {
  const playing = { serial: 's1', task: 't_bed', startedAt: T0, song: 60 };
  assert.equal(songProgress(playing, T0 + 61_000).left, 0);
  assert.equal(tap({ playing, now: T0 + 3 * 3600_000 }).kind, 'finish');
});

test('row: a token whose chore is done, waiting for a parent, or not on today\'s list is a small wave', () => {
  assert.deepEqual(tap({ record: { status: 'done' } }), { kind: 'wave', reason: 'done' });
  assert.deepEqual(tap({ record: { status: 'pending' } }), { kind: 'wave', reason: 'done' });
  assert.deepEqual(tap({ onToday: false }), { kind: 'wave', reason: 'not-today' });
});

test('row: a token nobody linked gets a puzzled look', () => {
  assert.deepEqual(tap({ found: null }), { kind: 'unlinked' });
});

test('a kid with a chore in play who taps another token gets a wave and the chore in play', () => {
  const playing = { serial: 's2', task: 't_dish', startedAt: T0, song: 120 };
  assert.deepEqual(tap({ playing, now: T0 + 60_000 }), { kind: 'wave', reason: 'busy', playing });
});

test('linking: one token, one chore; moving it takes it off the old chore or kid; the song length stays when the chore stays', () => {
  const kids = [kid('a'), kid('b')];
  assert.deepEqual(linkToken(kids, 'a', 's1', 't_bed', 60).map((k) => k.id), ['a']);
  assert.deepEqual(kids[0].tokens, { s1: { task: 't_bed', song: 60 } });
  assert.equal(findToken(kids, 's1').kid.id, 'a');
  assert.equal(findToken(kids, 'nope'), null);
  // same chore again keeps its length
  linkToken(kids, 'a', 's1', 't_bed');
  assert.equal(kids[0].tokens.s1.song, 60);
  // to another kid's chore
  assert.deepEqual(linkToken(kids, 'b', 's1', 't_dish', 120).map((k) => k.id).sort(), ['a', 'b']);
  assert.deepEqual(kids[0].tokens, {});
  assert.deepEqual(tokensFor(kids[1], 't_dish'), ['s1']);
  assert.equal(setSong(kids[1], 't_dish', 180), true);
  assert.equal(setSong(kids[1], 't_dish', 180), false);
  assert.equal(kids[1].tokens.s1.song, 180);
  assert.equal(unlinkToken(kids, 's1').id, 'b');
  assert.equal(unlinkToken(kids, 's1'), null);
  assert.deepEqual(kids[1].tokens, {});
});

test('chores in play are rebuilt from today\'s records: linked, on today\'s list, started, not checked off', () => {
  const a = kid('a', { s1: { task: 't_bed', song: 60 }, s2: { task: 't_dish', song: 120 } });
  const b = kid('b', { s3: { task: 't_bed', song: 60 } });
  const c = kid('c', { s4: { task: 't_bed', song: 60 } });
  const recs = {
    a: { t_bed: { startedAt: T0 }, t_dish: { startedAt: T0 + 5, status: 'done' } },
    b: { t_bed: { startedAt: T0 + 9 } },
    c: { t_bed: { startedAt: T0 } },
  };
  const out = inPlayFrom([a, b, c], (k) => recs[k.id], (k) => (k.id === 'c' ? [] : ['t_bed', 't_dish']));
  assert.deepEqual([...out.keys()], ['a', 'b']);
  assert.deepEqual(out.get('a'), { serial: 's1', task: 't_bed', startedAt: T0, song: 60 });
});

test('two kids at once: the song that started first plays; when it ends the other\'s carries on', () => {
  const playing = new Map([
    ['b', { task: 't_bed', startedAt: T0 + 10_000, song: 120 }],
    ['a', { task: 't_bed', startedAt: T0, song: 60 }],
  ]);
  assert.equal(songLead(playing, T0 + 30_000), 'a');
  assert.equal(songLead(playing, T0 + 61_000), 'b');
  assert.equal(songLead(playing, T0 + 131_000), null);
  assert.equal(songLead(new Map(), T0), null);
});

test('the song\'s last part, and how long a chore took', () => {
  assert.equal(endPart(60), 15);
  assert.equal(endPart(30), 10);
  assert.equal(endPart(300), 20);
  const p = { startedAt: T0, song: 60 };
  assert.equal(songProgress(p, T0 + 30_000).ending, false);
  assert.equal(songProgress(p, T0 + 50_000).ending, true);
  assert.equal(songProgress(p, T0 + 30_000).part, 0.5);
  assert.equal(tookText(45_000), '45 s');
  assert.equal(tookText(185_000), '3 min');
  assert.equal(tookText(65 * 60_000), '1 h 5 min');
  assert.equal(tokenNote({ status: 'done', by: 'token', startedAt: T0, at: T0 + 180_000, took: 180_000 }), 'Done with a token · took 3 min');
  assert.equal(tokenNote({ status: 'pending', by: 'token', startedAt: T0, at: T0 + 30_000, took: 30_000 }), 'Done with a token · took 30 s');
  // a parent's approval keeps how long it took
  assert.equal(tokenNote({ status: 'done', by: 'parent', startedAt: T0, at: T0 + 999_000, took: 30_000 }), 'Done with a token · took 30 s · approved');
  assert.equal(tokenNote({ status: 'done', by: 'self' }), '');
  assert.equal(tokenNote({ startedAt: T0 }), '');
});

// ---------- the write plan ----------

function family() {
  const s = emptyState();
  s.kids.push({ id: 'ka', name: 'Ava', tasks: [bed, dishes], owned: [], spent: 0 });
  s.kids.push({ id: 'kb', name: 'Ben', tasks: [bed, dishes], owned: [], spent: 0 });
  s.log['2026-11-26'] = {
    ka: { tasks: { t_dish: { status: 'done', at: 1, by: 'self' } } },
    kb: { tasks: { t_bed: { status: 'done', at: 2, by: 'self' } } },
  };
  return migrate(s);
}

test('the write plan: a first tap and a second tap each send only that chore\'s record', () => {
  const s = family();
  let before = splitState(s);
  applyTaskChange(s, 'ka', '2026-11-26', 't_bed', tap().save);
  let after = splitState(s);
  let plan = planWrites(diffDocs(before, after), before, after);
  assert.deepEqual(plan, [{ path: 'days/2026-11-26_ka', op: 'update', fields: [[['entry', 'tasks', 't_bed'], { startedAt: T0 }]] }]);

  before = after;
  const playing = { serial: 's1', task: 't_bed', startedAt: T0, song: 60 };
  applyTaskChange(s, 'ka', '2026-11-26', 't_bed', tap({ playing, now: T0 + 70_000 }).save);
  after = splitState(s);
  plan = planWrites(diffDocs(before, after), before, after);
  assert.deepEqual(plan, [{ path: 'days/2026-11-26_ka', op: 'update', fields: [[['entry', 'tasks', 't_bed'], { startedAt: T0, status: 'done', at: T0 + 70_000, by: 'token', took: 70_000 }]] }]);
});

test('the write plan: linking a token sends only that token\'s field, even the kid\'s first', () => {
  const s = family();
  let before = splitState(s);
  linkToken(s.kids, 'ka', '04:a1:b2', 't_bed', 60);
  let after = splitState(s);
  let plan = planWrites(diffDocs(before, after), before, after);
  assert.deepEqual(plan, [{ path: 'kids/ka', op: 'update', fields: [[['tokens', '04:a1:b2'], { task: 't_bed', song: 60 }]] }]);

  // moving it to the other kid: a delete of the old field and a set of the new one
  before = after;
  linkToken(s.kids, 'kb', '04:a1:b2', 't_dish', 120);
  after = splitState(s);
  plan = planWrites(diffDocs(before, after), before, after);
  assert.equal(plan.length, 2);
  const ka = plan.find((w) => w.path === 'kids/ka');
  const kb = plan.find((w) => w.path === 'kids/kb');
  assert.equal(ka.fields.length, 1);
  assert.deepEqual(ka.fields[0][0], ['tokens', '04:a1:b2']);
  assert.deepEqual(kb.fields, [[['tokens', '04:a1:b2'], { task: 't_dish', song: 120 }]]);
});
