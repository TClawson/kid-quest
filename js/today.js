// The kid's Today button and Today's quests list (inside the village, the house, the garden
// and the music house). Markup only: app.js works out what goes in them (todayQuests in
// logic.js) and what a tap does. The list is walk only: a quest's Go walks the buddy to whoever
// gives it, and a chore waiting for a parent can be asked about again.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The bar under the button: one piece per quest, green done, amber waiting for a parent, white to go. */
export const segBar = (segments) => `<span class="t-seg" aria-hidden="true">${segments.map((s) => `<i class="${s === 'done' ? 'd' : s === 'waiting' ? 'w' : ''}"></i>`).join('')}</span>`;

/**
 * The corner of the game window: the Today button, and a chest button while an earlier day's
 * chest is waiting. b: { toGo, waiting, total, complete, excused, segments, chest: { key, html, when } or null }.
 */
export function todayHud(b) {
  const what = b.excused ? 'day off' : b.total && b.complete ? 'all done!' : b.toGo ? `${b.toGo} to go` : b.waiting ? 'nearly!' : 'all done!';
  const label = `Today's quests: ${b.toGo} to go${b.waiting ? `, ${b.waiting} waiting for a parent` : ''}`;
  return `
      <div class="v-hud">
        <button class="today-btn ${b.total && b.complete ? 'all' : ''}" data-action="today" aria-label="${esc(label)}">
          <b>📜 Today <em>${esc(what)}</em></b>
          ${b.total ? segBar(b.segments) : ''}
          ${b.waiting ? `<span class="t-nb amber" aria-hidden="true">⏳${b.waiting}</span>` : ''}
        </button>
        ${b.chest ? `<button class="hud-chest" data-action="chest" data-day="${esc(b.chest.key)}" aria-label="Open the chest from ${esc(b.chest.when)}">${b.chest.html}<small>Chest!</small><span class="t-nb">1</span></button>` : ''}
      </div>`;
}

/**
 * Today's quests. t: {
 *   kidId, head: 'Thursday · 5 of 9 done · 1 waiting for a parent',
 *   groups: [{ id, icon, name, note, rows: [{ id, icon, name, star, sub, state, next, action }] }]
 *     (action: 'go' for a quest still to do, 'ask' for one waiting for a parent, '' for done),
 *   chest: { text (markup), ready } (today's chest), shop: { open, text }, plan: true,
 * }
 */
export function todayListHtml(t) {
  const row = (r) => {
    const btn = r.action === 'go'
      ? `<button class="t-go ${r.next ? '' : 'ghost'}" data-action="today-go" data-id="${esc(r.id)}" aria-label="Go to ${esc(r.name)}">${r.next ? '▶' : '➜'} Go</button>`
      : r.action === 'ask'
        ? `<button class="t-go ghost" data-action="today-ask" data-id="${esc(r.id)}">🙋 Ask now</button>`
        : r.state === 'done' ? '<span class="t-st">✓ Done</span>' : '';
    return `
          <div class="t-q ${r.state} ${r.next ? 'next' : ''}" data-id="${esc(r.id)}">
            <span class="t-ic" aria-hidden="true">${esc(r.icon)}</span>
            <span class="t-tx"><b>${esc(r.name)}${r.star ? ' <span class="t-star" title="Mastered habit">⭐</span>' : ''}</b><small>${esc(r.sub)}</small></span>
            ${btn}
          </div>`;
  };
  const group = (g) => `
        <div class="t-grp" data-group="${esc(g.id)}">
          <h3>${esc(g.icon)} ${esc(g.name)} <small>${esc(g.note)}</small></h3>
          ${g.rows.map(row).join('')}
        </div>`;
  // two columns on a wide screen: morning (and the exercise) on the left, the rest of the day on the right
  const left = t.groups.filter((g) => g.id === 'morning' || g.id === 'exercise');
  const right = t.groups.filter((g) => g.id !== 'morning' && g.id !== 'exercise');
  const cols = left.length && right.length
    ? `<div class="t-cols"><div>${left.map(group).join('')}</div><div>${right.map(group).join('')}</div></div>`
    : `<div class="t-cols one"><div>${t.groups.map(group).join('')}</div></div>`;
  return `
    <div class="today-pop" data-kid="${esc(t.kidId)}">
      <div class="t-head">
        <h2>📜 Today's quests</h2>
        <span class="t-sub">${esc(t.head)}</span>
        <button class="t-x" data-action="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="t-body">${t.groups.length ? cols : '<p class="muted">No quests today. Enjoy your day off!</p>'}</div>
      <div class="t-foot">
        ${t.chest.ready ? `<button class="t-tag ready" data-action="today-chest">${t.chest.text}</button>` : `<span class="t-tag">${t.chest.text}</span>`}
        <button class="t-tag ${t.shop.open ? 'open' : ''}" data-action="today-shop">${esc(t.shop.text)}</button>
        <button class="t-tag" data-action="plan" data-kid="${esc(t.kidId)}">📝 Plan my day</button>
      </div>
    </div>`;
}
