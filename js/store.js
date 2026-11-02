// Storage layer. Everything the app saves goes through here, so the place it is
// saved (local storage today, the family cloud later) can change without
// touching the game code.
//
// The state is still one object in memory. For saving it is also viewed as a
// set of small documents (see splitState), which is the shape the cloud will
// use: one family doc, one doc per kid, one doc per kid per day. save() reports
// which of those documents changed, so a cloud backend only writes those.

import { emptyState } from './logic.js';
import { defaultBuddy, speciesFromEmoji } from './items.js';

export const STORAGE_KEY = 'kidquest.v1';

// Settings that belong to one device (or one Android user), not the family.
export const DEVICE_SETTINGS = ['sound', 'music', 'questView'];

// Bring saved data from any older version up to the current shape.
export function migrate(s) {
  const base = emptyState();
  const kids = (s.kids || []).map((k) => ({
    ...k,
    buddy: k.buddy || defaultBuddy(speciesFromEmoji(k.avatar)),
    seenUnlocks: k.seenUnlocks || [],
  }));
  return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, log: s.log || {}, kids, celebrations: s.celebrations || {} };
}

const dayDocId = (date, kidId) => `${date}_${kidId}`;

// state -> { family, device, kids: {kidId: doc}, days: {date_kidId: doc} }
// The documents are copies, so later changes to the state don't reach them.
export function splitState(live) {
  const state = structuredClone(live);
  const familySettings = {};
  const device = {};
  for (const [k, v] of Object.entries(state.settings || {})) {
    if (DEVICE_SETTINGS.includes(k)) device[k] = v;
    else familySettings[k] = v;
  }
  const kids = {};
  state.kids.forEach((kid, order) => {
    const doc = { ...kid, order };
    const celebration = state.celebrations?.[kid.id];
    if (celebration !== undefined) doc.celebration = celebration;
    kids[kid.id] = doc;
  });
  const days = {};
  for (const [date, byKid] of Object.entries(state.log || {})) {
    for (const [kidId, entry] of Object.entries(byKid || {})) {
      days[dayDocId(date, kidId)] = { date, kidId, entry };
    }
  }
  return { family: { version: state.version, settings: familySettings }, device, kids, days };
}

// The reverse of splitState.
export function joinState({ family = {}, device = {}, kids = {}, days = {} }) {
  const celebrations = {};
  const kidList = Object.values(kids)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(({ order, celebration, ...kid }) => {
      if (celebration !== undefined) celebrations[kid.id] = celebration;
      return kid;
    });
  const log = {};
  for (const { date, kidId, entry } of Object.values(days)) {
    (log[date] ||= {})[kidId] = entry;
  }
  return migrate({
    ...(family.version !== undefined ? { version: family.version } : {}),
    settings: { ...(family.settings || {}), ...device },
    kids: kidList,
    log,
    celebrations,
  });
}

// Which documents differ between two splitState results. Paths look like
// 'family', 'device', 'kids/<kidId>', 'days/<date>_<kidId>'.
export function diffDocs(before, after) {
  const flat = (parts) => {
    const out = new Map();
    if (!parts) return out;
    out.set('family', JSON.stringify(parts.family));
    out.set('device', JSON.stringify(parts.device));
    for (const [id, doc] of Object.entries(parts.kids)) out.set(`kids/${id}`, JSON.stringify(doc));
    for (const [id, doc] of Object.entries(parts.days)) out.set(`days/${id}`, JSON.stringify(doc));
    return out;
  };
  const a = flat(before);
  const b = flat(after);
  const changed = [...b.keys()].filter((k) => a.get(k) !== b.get(k));
  const removed = [...a.keys()].filter((k) => !b.has(k));
  return { changed, removed };
}

// Keeps the whole state as one JSON string, like every version so far.
export function localBackend(storage = globalThis.localStorage, key = STORAGE_KEY) {
  return {
    read: () => storage.getItem(key),
    write: (text) => storage.setItem(key, text),
  };
}

export function createStore(backend = localBackend()) {
  let lastDocs = null;
  return {
    // Never throws: unreadable data starts a fresh state, as before.
    load() {
      let state;
      try {
        const raw = backend.read();
        state = raw ? migrate(JSON.parse(raw)) : emptyState();
      } catch {
        state = emptyState();
      }
      lastDocs = splitState(state);
      return state;
    },
    // Throws if the backend cannot save (for example, storage is full).
    // Returns which documents changed since the last load or save.
    save(state) {
      backend.write(JSON.stringify(state));
      const docs = splitState(state);
      const changes = diffDocs(lastDocs, docs);
      lastDocs = docs;
      return changes;
    },
  };
}
