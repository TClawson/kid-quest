import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, newId } from '../js/logic.js';
import { migrate, splitState, joinState, diffDocs, diffFields, nestFields, planWrites, DELETE, AddTo, Increase, createStore, localBackend, STORAGE_KEY, packLog, unpackLog } from '../js/store.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

function sampleState() {
  const state = emptyState();
  state.settings.pinHash = 'abc';
  state.settings.music = false;
  state.settings.questView = 'map';
  const a = { id: newId('kid'), name: 'Ava', tasks: defaultTasks(), startDate: '2026-11-01', owned: ['hat-1'], spent: 40 };
  const b = { id: newId('kid'), name: 'Ben', tasks: defaultTasks(), startDate: '2026-11-01' };
  state.kids.push(a, b);
  state.log['2026-11-01'] = { [a.id]: { tasks: { t1: { status: 'done' } } }, [b.id]: { tasks: {}, excused: true } };
  state.log['2026-11-02'] = { [a.id]: { tasks: { t1: { status: 'pending', seconds: 1800 } } } };
  state.celebrations[a.id] = { day: '2026-11-01', streak: 7 };
  return migrate(state);
}

test('split then join gives back the same state', () => {
  const state = sampleState();
  assert.deepEqual(joinState(splitState(state)), state);
});

test('split puts each kid, each kid-day and device settings in their own documents', () => {
  const state = sampleState();
  const [a, b] = state.kids;
  const parts = splitState(state);
  assert.deepEqual(Object.keys(parts.kids), [a.id, b.id]);
  assert.equal(Object.keys(parts.days).length, 3);
  assert.equal(parts.days[`2026-11-01_${b.id}`].entry.excused, true);
  assert.deepEqual(parts.kids[a.id].celebration, { day: '2026-11-01', streak: 7 });
  assert.deepEqual(parts.device, { sound: true, music: false, questView: 'map' });
  assert.equal(parts.family.settings.pinHash, 'abc');
  assert.equal('music' in parts.family.settings, false);
});

test('join keeps kid order', () => {
  const state = sampleState();
  const joined = joinState(splitState(state));
  assert.deepEqual(joined.kids.map((k) => k.name), ['Ava', 'Ben']);
});

test('diffDocs reports only the documents that changed', () => {
  const state = sampleState();
  const [a, b] = state.kids;
  const before = splitState(state);
  state.log['2026-11-02'][a.id].tasks.t1.status = 'done';
  state.kids[1].spent = 10;
  delete state.log['2026-11-01'][b.id];
  const { changed, removed } = diffDocs(before, splitState(state));
  assert.deepEqual(changed.sort(), [`days/2026-11-02_${a.id}`, `kids/${b.id}`].sort());
  assert.deepEqual(removed, [`days/2026-11-01_${b.id}`]);
});

test('store reads and writes the same local storage key as before', () => {
  const state = sampleState();
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) });
  const store = createStore(localBackend(storage));
  const loaded = store.load();
  assert.deepEqual(loaded, state);
  loaded.settings.weeklyReward = 'Pizza night';
  const { changed } = store.save(loaded);
  assert.deepEqual(changed, ['family']);
  assert.equal(JSON.parse(storage.data[STORAGE_KEY]).settings.weeklyReward, 'Pizza night');
});

test('store starts fresh on missing or broken data', () => {
  assert.deepEqual(createStore(localBackend(memoryStorage())).load(), emptyState());
  assert.deepEqual(createStore(localBackend(memoryStorage({ [STORAGE_KEY]: '{oops' }))).load(), emptyState());
});

test('a failed save throws and does not lose track of unsaved changes', () => {
  let fail = true;
  const storage = memoryStorage();
  const store = createStore({ read: () => null, write: (t) => { if (fail) throw new Error('full'); storage.setItem(STORAGE_KEY, t); } });
  const state = store.load();
  state.settings.weeklyReward = 'Ice cream';
  assert.throws(() => store.save(state));
  fail = false;
  assert.deepEqual(store.save(state).changed, ['family']);
});

test('a family device keeps syncing when its local storage is full', () => {
  const calls = [];
  const store = createStore({ read: () => null, write: () => { throw new Error('full'); } }, { onSave: (changes) => calls.push(changes.changed) });
  const state = store.load();
  state.settings.weeklyReward = 'Ice cream';
  const result = store.save(state);
  assert.deepEqual(calls, [['family']]);
  assert.equal(result.local, false);
  assert.doesNotThrow(() => store.replace(state));
});

// A year of days whose scheduled tasks repeat, like the real app.
function yearOfDays() {
  const tasks = [
    { id: 't1', name: 'Brush teeth', days: [0, 1, 2, 3, 4, 5, 6], pay: { coins: 10, xp: 10 } },
    { id: 't2', name: 'Piano', timer: 30, days: [1, 2, 3, 4, 5], pay: { coins: 30, xp: 30 } },
  ];
  const state = { ...emptyState(), kids: [{ id: 'k1', name: 'Ava', tasks }, { id: 'k2', name: 'Ben', tasks }] };
  for (let i = 0; i < 365; i += 1) {
    const date = `2026-${String(1 + Math.floor(i / 31)).padStart(2, '0')}-${String(1 + (i % 31)).padStart(2, '0')}`;
    state.log[date] = {};
    for (const kid of state.kids) {
      state.log[date][kid.id] = {
        tasks: { t1: { status: 'approved', at: 1700000000000 + i, by: 'parent' } },
        excused: false,
        scheduled: tasks.map((t) => ({ ...t, pay: { ...t.pay, coins: i > 200 ? 15 : t.pay.coins } })),
      };
    }
  }
  state.log['2026-12-31'] = { k1: { tasks: {}, excused: true } }; // a day without a schedule
  return state;
}

test('the local copy is packed, and unpacks to exactly the same state', () => {
  const state = yearOfDays();
  const packed = packLog(state);
  assert.equal(packed.taskTable.length, 4); // each different task once
  assert.ok(JSON.stringify(packed).length < JSON.stringify(state).length / 2);
  assert.deepEqual(unpackLog(JSON.parse(JSON.stringify(packed))), state);
  assert.deepEqual(state.log['2026-01-01'].k1.scheduled[0].name, 'Brush teeth'); // the state itself is untouched
});

test('unpacked days are separate objects, and old unpacked copies still load', () => {
  const state = yearOfDays();
  const back = unpackLog(JSON.parse(JSON.stringify(packLog(state))));
  back.log['2026-01-01'].k1.scheduled[0].name = 'Changed';
  assert.equal(back.log['2026-01-02'].k1.scheduled[0].name, 'Brush teeth');
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(state) });
  const store = createStore(localBackend(storage));
  assert.deepEqual(store.load(), migrate(state));
  store.save(store.load());
  assert.ok(JSON.parse(storage.data[STORAGE_KEY]).taskTable, 'saved packed');
  assert.deepEqual(createStore(localBackend(storage)).load(), migrate(state));
});

test('migrate fills in buddies for old saves', () => {
  const old = { settings: {}, kids: [{ id: 'k1', name: 'Old', avatar: '🦊', tasks: [] }] };
  const s = migrate(old);
  assert.ok(s.kids[0].buddy);
  assert.deepEqual(s.kids[0].seenUnlocks, []);
  assert.deepEqual(s.log, {});
});

test('diffFields finds changed, added and removed fields down to task level', async () => {
  const { diffFields, DELETE } = await import('../js/store.js');
  const before = { date: 'd', kidId: 'k', entry: { tasks: { a: { status: 'pending' }, b: { status: 'done' } }, excused: true } };
  const after = { date: 'd', kidId: 'k', entry: { tasks: { a: { status: 'done', by: 'parent' }, c: { status: 'done' } } } };
  const out = diffFields(before, after);
  const byPath = Object.fromEntries(out.map(([p, v]) => [p.join('.'), v]));
  assert.deepEqual(byPath, {
    'entry.tasks.a': { status: 'done', by: 'parent' },
    'entry.tasks.b': DELETE,
    'entry.tasks.c': { status: 'done' },
    'entry.excused': DELETE,
  });
});

test('onSave reports changes, and replace() does not', () => {
  const calls = [];
  const storage = memoryStorage();
  const store = createStore(localBackend(storage), { onSave: (changes) => calls.push(changes.changed) });
  const state = store.load();
  state.settings.weeklyReward = 'Bowling';
  store.save(state);
  const remote = JSON.parse(JSON.stringify(state));
  remote.settings.weeklyReward = 'Skating';
  store.replace(remote);
  store.save(remote);
  assert.deepEqual(calls, [['family']]);
  assert.equal(JSON.parse(storage.data[STORAGE_KEY]).settings.weeklyReward, 'Skating');
});

test('migrate moves worn items a kid owned to their current buddy', () => {
  const s = migrate({ kids: [{ id: 'k', name: 'A', owned: ['hat-cap', 'bg-ocean'], buddy: { species: 'cat', outfit: { hat: 'hat-cap' } } }] });
  assert.deepEqual(s.kids[0].owned, ['bg-ocean']);
  assert.deepEqual(s.kids[0].buddyOwned, { cat: ['hat-cap'] });
});

test('nestFields turns field changes into one nested object for a merging set', () => {
  const before = { entry: { tasks: { a: { status: 'done' }, b: { status: 'done' } }, note: 'x' } };
  const after = { entry: { tasks: { a: { status: 'approved' } }, bonus: 5 } };
  const nested = nestFields(diffFields(before, after));
  assert.deepEqual(nested.entry.tasks.a, { status: 'approved' });
  assert.equal(nested.entry.tasks.b, DELETE);
  assert.equal(nested.entry.note, DELETE);
  assert.equal(nested.entry.bonus, 5);
});

test('planWrites: merge new documents, update changed fields, patch pending creates', () => {
  const before = splitState({ ...emptyStateForPlan(), log: { '2026-11-01': { k1: { tasks: { a: { status: 'done' } } } } } });
  const afterState = emptyStateForPlan();
  afterState.settings.sound = false; // device only
  afterState.kids[0].spent = 5;
  afterState.log = { '2026-11-02': { k1: { tasks: {} } } };
  const after = splitState(afterState);
  const changes = diffDocs(before, after);
  const plan = planWrites(changes, before, after);
  const byPath = Object.fromEntries(plan.map((w) => [w.path, w]));
  assert.equal(byPath.device, undefined, 'device settings stay on the device');
  assert.equal(byPath['days/2026-11-02_k1'].op, 'merge');
  assert.deepEqual(byPath['days/2026-11-02_k1'].data, { date: '2026-11-02', kidId: 'k1', entry: { tasks: {} } });
  assert.equal(byPath['days/2026-11-01_k1'].op, 'delete');
  assert.equal(byPath['kids/k1'].op, 'update');
  assert.deepEqual(byPath['kids/k1'].fields, [[['spent'], new Increase(5)]], 'spending goes as a change, so an old copy cannot undo another device\'s');
  const pending = planWrites(changes, before, after, new Set(['kids/k1']));
  assert.equal(pending.find((w) => w.path === 'kids/k1').op, 'patch');
  assert.equal(planWrites(changes, null, after).every((w) => w.op === 'merge' || w.op === 'delete'), true);
});

function emptyStateForPlan() {
  return migrate({ kids: [{ id: 'k1', name: 'Ava', tasks: [], spent: 0 }], log: {} });
}

test('a kid\'s daily summary (for the family village) survives migrate and split, and syncs a day at a time', () => {
  const state = sampleState();
  state.kids[0].daily = { '2026-11-10': [4, 5], '2026-11-11': [5, 5] };
  const again = migrate(structuredClone(state));
  assert.deepEqual(again.kids[0].daily, state.kids[0].daily);
  const docs = splitState(again);
  assert.deepEqual(docs.kids[state.kids[0].id].daily, state.kids[0].daily);
  assert.deepEqual(joinState(docs).kids[0].daily, state.kids[0].daily);
  const next = structuredClone(docs);
  next.kids[state.kids[0].id].daily['2026-11-12'] = [3, 5];
  const fields = diffFields(docs.kids[state.kids[0].id], next.kids[state.kids[0].id]);
  assert.deepEqual(fields, [[['daily', '2026-11-12'], [3, 5]]]);
});

test('purchases sync as additions: a device on an old copy cannot wipe things bought since', () => {
  const mk = (kid) => splitState(migrate({ kids: [{ id: 'k1', name: 'Ed', tasks: [], ...kid }], log: {} }));
  // the old copy has the rainforest; the server also has the volcano, bought later elsewhere
  const before = mk({ owned: ['bg-rainforest'], spent: 300, grants: [], buddyOwned: { fox: ['hat-cap'] } });
  const after = mk({ owned: ['bg-rainforest', 'song:bg-meadow'], spent: 320, grants: ['g1'], buddyOwned: { fox: ['hat-cap', 'face-round'], cat: ['hat-cap'] } });
  const plan = planWrites(diffDocs(before, after), before, after);
  const fields = Object.fromEntries(plan.find((w) => w.path === 'kids/k1').fields.map(([p, v]) => [p.join('.'), v]));
  assert.deepEqual(fields.owned, new AddTo(['song:bg-meadow']));
  assert.deepEqual(fields.spent, new Increase(20));
  assert.deepEqual(fields.grants, new AddTo(['g1']));
  assert.deepEqual(fields['buddyOwned.fox'], new AddTo(['face-round']));
  assert.deepEqual(fields['buddyOwned.cat'], new AddTo(['hat-cap']));
});

test('taking something out of a list still sends the whole list', () => {
  const mk = (kid) => splitState(migrate({ kids: [{ id: 'k1', name: 'Ed', tasks: [], ...kid }], log: {} }));
  const before = mk({ owned: ['bg-rainforest', 'bg-ocean'] });
  const after = mk({ owned: ['bg-rainforest'] });
  const fields = planWrites(diffDocs(before, after), before, after).find((w) => w.path === 'kids/k1').fields;
  assert.deepEqual(fields.find(([p]) => p[0] === 'owned')[1], ['bg-rainforest']);
});
