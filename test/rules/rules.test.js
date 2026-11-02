// Security rules tests. Run with: npm run test:rules (starts the Firestore emulator).
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, writeBatch, Timestamp, deleteDoc } from 'firebase/firestore';

let env;
const FID = 'fam1';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-kid-quest',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8180 },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const soon = () => Timestamp.fromMillis(Date.now() + 10 * 60000);

// A family with parent 'mom' and kid device 'ava-tab', set up without rules.
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'families', FID), { createdBy: 'mom', settings: { pinHash: 'x' } });
    await setDoc(doc(db, 'families', FID, 'members', 'mom'), { role: 'parent' });
    await setDoc(doc(db, 'families', FID, 'members', 'ava-tab'), { role: 'kid', kidId: 'ava' });
    await setDoc(doc(db, 'families', FID, 'kids', 'ava'), { name: 'Ava' });
    await setDoc(doc(db, 'joinCodes', 'KGOOD'), { familyId: FID, role: 'kid', expiresAt: soon() });
    await setDoc(doc(db, 'joinCodes', 'POLD'), { familyId: FID, role: 'parent', expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  });
}

test('a parent can create a family with themselves as first member', async () => {
  const db = as('dad');
  const b = writeBatch(db);
  b.set(doc(db, 'families', 'new'), { createdBy: 'dad', settings: {} });
  b.set(doc(db, 'families', 'new', 'members', 'dad'), { role: 'parent' });
  b.set(doc(db, 'users', 'dad'), { familyId: 'new' });
  await assertSucceeds(b.commit());
});

test('nobody can add themselves to an existing family without a code', async () => {
  await seed();
  const db = as('stranger');
  await assertFails(setDoc(doc(db, 'families', FID, 'members', 'stranger'), { role: 'parent' }));
  await assertFails(setDoc(doc(db, 'families', FID, 'members', 'stranger'), { role: 'parent', code: 'NOPE' }));
});

test('a valid kid code lets a device join as a kid, not as a parent', async () => {
  await seed();
  const db = as('ben-tab');
  await assertFails(setDoc(doc(db, 'families', FID, 'members', 'ben-tab'), { role: 'parent', code: 'KGOOD' }));
  const b = writeBatch(db);
  b.set(doc(db, 'families', FID, 'members', 'ben-tab'), { role: 'kid', code: 'KGOOD', kidId: 'ben' });
  b.set(doc(db, 'users', 'ben-tab'), { familyId: FID });
  await assertSucceeds(b.commit());
  await assertSucceeds(setDoc(doc(db, 'families', FID, 'kids', 'ben'), { name: 'Ben' }));
});

test('an expired code does not work', async () => {
  await seed();
  await assertFails(setDoc(doc(as('x'), 'families', FID, 'members', 'x'), { role: 'parent', code: 'POLD' }));
});

test('outsiders cannot read or change family data', async () => {
  await seed();
  for (const db of [as('stranger'), anon()]) {
    await assertFails(getDoc(doc(db, 'families', FID)));
    await assertFails(getDoc(doc(db, 'families', FID, 'kids', 'ava')));
    await assertFails(getDocs(collection(db, 'families', FID, 'days')));
    await assertFails(setDoc(doc(db, 'families', FID, 'kids', 'eve'), { name: 'Eve' }));
  }
});

test('members can read and write kids and days', async () => {
  await seed();
  const db = as('ava-tab');
  await assertSucceeds(getDoc(doc(db, 'families', FID)));
  await assertSucceeds(setDoc(doc(db, 'families', FID, 'days', '2026-11-02_ava'), { date: '2026-11-02', kidId: 'ava', entry: {} }));
  await assertSucceeds(getDocs(collection(db, 'families', FID, 'kids')));
});

test('only parents make join codes, and codes cannot be listed', async () => {
  await seed();
  const code = { familyId: FID, role: 'kid', createdBy: 'ava-tab', expiresAt: soon() };
  await assertFails(setDoc(doc(as('ava-tab'), 'joinCodes', 'KX'), code));
  await assertSucceeds(setDoc(doc(as('mom'), 'joinCodes', 'KY'), { ...code, createdBy: 'mom' }));
  await assertFails(getDocs(collection(as('mom'), 'joinCodes')));
  await assertSucceeds(getDoc(doc(as('anyone'), 'joinCodes', 'KGOOD')));
  await assertFails(getDoc(doc(anon(), 'joinCodes', 'KGOOD')));
});

test('people can only point their own user record at a family they belong to', async () => {
  await seed();
  await assertFails(setDoc(doc(as('stranger'), 'users', 'stranger'), { familyId: FID }));
  await assertFails(setDoc(doc(as('mom'), 'users', 'dad'), { familyId: FID }));
  await assertSucceeds(setDoc(doc(as('mom'), 'users', 'mom'), { familyId: FID }));
});

test('kids cannot remove other members; parents can', async () => {
  await seed();
  await assertFails(deleteDoc(doc(as('ava-tab'), 'families', FID, 'members', 'mom')));
  await assertSucceeds(deleteDoc(doc(as('mom'), 'families', FID, 'members', 'ava-tab')));
});
