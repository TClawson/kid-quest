// What app.js shares with the modules split out of it (timer-ui.js, ...).
//
// These are live bindings: app.js fills them in once at start (provide), and an
// import always sees the current value. state is replaced on every family update
// (setState), so it must be read when it is used, never kept in a variable.
// A module reads these only inside its functions, never at its top level: they
// are empty until app.js has run.

export let state;
/** Replace the whole state (a family update, a restored backup). */
export function setState(next) { state = next; }

export let ui, $modal, today, esc, kidById, taskById, liveKey, dressed;
export let save, render, viewKid, markDone, askParentNowOrLater;
export let toast, actions, openModal, closeModal, confirmModal;
export let cloud, cloudCfg, family, store, CLOUD_KEY, CLOUD_CACHE_KEY, BUDDIES_KEY;

/** app.js hands over its shared things, by name. */
export function provide(parts) {
  ({ ui, $modal, today, esc, kidById, taskById, liveKey, dressed } = parts);
  ({ save, render, viewKid, markDone, askParentNowOrLater } = parts);
  ({ toast, actions, openModal, closeModal, confirmModal } = parts);
  ({ cloud, cloudCfg, family, store, CLOUD_KEY, CLOUD_CACHE_KEY, BUDDIES_KEY } = parts);
}
