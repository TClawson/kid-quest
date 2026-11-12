// The kid's screen is the village (or the house, the garden, the music house), full screen, with
// a small HUD over its corners and two pop-ups for everything else. Markup only: app.js works out
// what goes in them and what a tap does.
//
//   top left:     the buddy plate (face, name, level bar): opens Status
//   top centre:   the family's progress (with more than one kid): tap for the party once it's earned
//   top right:    streak, coins and gems in one pill (opens Status), and the Menu button
//   bottom left:  the Today button and an earlier day's chest (today.js)
//   bottom right: the Shop, with a padlock while it is shut (a tap then says why)
//
// The HUD is drawn with the screen, so its numbers change only when the screen is redrawn (when
// something changed); nothing in it is laid out again per frame.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * h: {
 *   name, face: the buddy's small picture (markup), level, into: 0-100 toward the next level,
 *   streak, coins, gems: a number, or null when gems aren't part of this kid's game yet,
 *   family: { happy, done, total, unknown, pct (0-100 toward the party) } or null (one kid),
 *   today: the Today button and chest button (todayHud in today.js),
 *   shop: { open, fresh: new things waiting in the shop },
 * }
 */
export function kidHudHtml(h) {
  const fam = h.family;
  const famText = fam ? (fam.happy ? '🎉 Family party!' : fam.unknown ? `Family ${fam.done} done` : `Family ${fam.done} / ${fam.total}`) : '';
  const famLabel = fam ? (fam.happy ? 'The family party is on! Tap to celebrate' : `How the family is doing today: ${fam.unknown ? `${fam.done} chores done` : `${fam.done} of ${fam.total} chores done`}`) : '';
  return `
      <div class="k-hud">
        <button class="k-plate" data-action="status" data-tab="me" aria-label="${esc(`${h.name}, level ${h.level}: open my status`)}">
          <span class="k-face" aria-hidden="true">${h.face}</span>
          <span class="k-who"><b>${esc(h.name)}</b><small>Lv ${h.level} <i class="k-xp"><i style="width:${Math.max(0, Math.min(100, h.into))}%"></i></i></small></span>
        </button>
        ${fam ? `<button class="k-fam ${fam.happy ? 'happy' : ''}" data-action="family-pill" aria-label="${esc(famLabel)}"><span aria-hidden="true">👪</span> ${esc(famText)}${fam.happy ? '' : `<i class="k-fbar" aria-hidden="true"><i style="width:${fam.pct}%"></i></i>`}</button>` : ''}
        <div class="k-tr">
          <button class="k-pill" data-action="status" data-tab="me" aria-label="${esc(`Streak ${h.streak} days, ${h.coins} coins${h.gems === null ? '' : `, ${h.gems} gems`}: open my status`)}">
            <span class="k-streak ${h.streak ? '' : 'cold'}">🔥 ${h.streak}</span><span class="k-coin">🪙 ${h.coins}</span>${h.gems === null ? '' : `<span class="k-gem">💎 ${h.gems}</span>`}
          </button>
          <button class="k-sq k-menu" data-action="menu" aria-label="Menu"><span class="k-burger" aria-hidden="true"><i></i><i></i><i></i></span></button>
        </div>
        ${h.today}
        <div class="k-br">
          <button class="k-sq big k-shop ${h.shop.open ? 'open' : 'locked'}" data-action="wardrobe" aria-label="${h.shop.open ? 'Shop' : 'Shop (shut for now)'}"><span aria-hidden="true">👕</span><small>Shop</small>${h.shop.open ? (h.shop.fresh ? '<span class="t-nb">new</span>' : '') : '<span class="k-lock" aria-hidden="true">🔒</span>'}</button>
        </div>
      </div>`;
}

export const STATUS_TABS = [
  { id: 'me', name: 'Me' },
  { id: 'week', name: 'This week' },
  { id: 'habits', name: 'Habits' },
  { id: 'trophies', name: '🏆 Trophies' },
];

/**
 * The Status pop-up. s: { kidId, name, sub: 'Level 33 · 55 XP to level 34', tab, body: the tab's markup }.
 * Its foot links to Plan my day, the family's game scores and the fish book.
 */
export function statusHtml(s) {
  return `
    <div class="status-pop" data-kid="${esc(s.kidId)}" data-tab="${esc(s.tab)}">
      <div class="p-head">
        <span class="p-star" aria-hidden="true">⭐</span>
        <h2>${esc(s.name)}</h2>
        <span class="p-sub">${esc(s.sub)}</span>
        <button class="p-x" data-action="modal-close" aria-label="Close">✕</button>
      </div>
      <nav class="p-tabs" role="tablist">${STATUS_TABS.map((t) => `<button class="${t.id === s.tab ? 'on' : ''}" role="tab" aria-selected="${t.id === s.tab}" data-action="status-tab" data-tab="${t.id}">${esc(t.name)}</button>`).join('')}</nav>
      <div class="p-body p-${esc(s.tab)}">${s.body}</div>
      <div class="p-foot">
        <button class="t-tag" data-action="plan" data-kid="${esc(s.kidId)}">📝 Plan my day</button>
        <button class="t-tag" data-action="status-scores">📊 Family game scores</button>
        <button class="t-tag" data-action="status-fish">🐟 Fish book</button>
      </div>
    </div>`;
}

/**
 * The Menu pop-up. m: { kidId, music: map music wanted, sound: sounds on (music needs them too),
 *   kids: how many kids this device has, parents: { open: a parent's phone (no PIN), waiting: chores
 *   waiting for a parent } }.
 */
export function menuHtml(m) {
  const item = (action, icon, name, note = '', extra = '') => `<button class="m-item" data-action="${action}" ${extra}><span class="m-ic" aria-hidden="true">${icon}</span><b>${esc(name)}</b>${note ? `<small>${esc(note)}</small>` : ''}</button>`;
  return `
    <div class="menu-pop" data-kid="${esc(m.kidId)}">
      <div class="p-head">
        <span class="p-star k-burger" aria-hidden="true"><i></i><i></i><i></i></span>
        <h2>Menu</h2>
        <button class="p-x" data-action="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="m-list">
        ${item('menu-music', m.music && m.sound ? '🎵' : '🔇', 'Music', !m.sound ? 'Off (sounds are off)' : m.music ? 'On' : 'Off', `aria-pressed="${Boolean(m.music && m.sound)}"`)}
        ${item('menu-sound', m.sound ? '🔊' : '🔈', 'Sounds', m.sound ? 'On' : 'Off', `aria-pressed="${Boolean(m.sound)}"`)}
        ${item('plan', '📝', 'Plan my day', '', `data-kid="${esc(m.kidId)}"`)}
        ${item('old-map', '🗺️', 'Old map', 'for a little while')}
        ${m.kids > 1 ? item('menu-switch', '🔁', 'Switch kid') : ''}
        ${item('menu-parents', m.parents.open ? '👪' : '🔒', 'Parents', [m.parents.open ? '' : 'PIN', m.parents.waiting ? `${m.parents.waiting} waiting` : ''].filter(Boolean).join(' · '))}
      </div>
    </div>`;
}
