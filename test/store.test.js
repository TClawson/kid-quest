import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, newId } from '../js/logic.js';
import { migrate, splitState, joinState, diffDocs, createStore, localBackend, STORAGE_KEY } from '../js/store.js';

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
