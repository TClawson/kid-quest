// The shortcut book on screen: every ski shortcut a kid has found on every hill, with its badge,
// the snow kinds it's been skied on, the fastest run through it and a real-world fact (the data
// and badges are in skibook.js, the shortcuts in skicourses.js). Opened from the Status pop-up.
import { COURSES } from './skicourses.js';
import { HILLS, snowWords, hillFor, SNOW_IDS } from './slopes.js';
import { hillCount, BADGE_NAMES } from './skibook.js';
import { shownSeason } from './seasons.js';
import { esc, openModal, kidTheme, today } from './ctx.js';

const MEDAL = { bronze: '🥉', silver: '🥈', gold: '🥇' };
const RARE = { common: '', uncommon: 'Uncommon', legendary: 'Legendary!' };
const fmtDay = (key) => (key ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

export function openSkiBook(kid) {
  if (!kid) return;
  const book = kid.skiBook || {};
  const season = shownSeason(today());
  // the kid's own map first, then the rest
  const mine = kidTheme(kid);
  const maps = Object.keys(COURSES).sort((a, b) => (a === mine ? -1 : b === mine ? 1 : 0));
  let found = 0; let total = 0;
  const pages = maps.map((map) => {
    const hill = hillFor(map, season);
    const n = hillCount(book, map); found += n.found; total += n.total;
    const best = book[map]?.best || {};
    const times = SNOW_IDS.filter((k) => best[k] != null).map((k) => { const w = snowWords(k, hill.surface); return `${w.emoji} ${best[k].toFixed(1)} s`; }).join(' · ');
    return `
      <div class="sb-map">
        <h3>🎿 ${esc(HILLS[map].name)} <small>${n.found} of ${n.total}${times ? ` · best ${times}` : ''}</small></h3>
        <div class="sb-grid">
          ${COURSES[map].shortcuts.map((s) => {
            const f = book[map]?.found?.[s.id];
            const only = s.snow ? `Only on ${snowWords(s.snow, hill.surface).emoji} ${esc(snowWords(s.snow, hill.surface).name.toLowerCase())} days` : '';
            if (!f) return `<div class="sb-card none ${s.rarity}"><b>???</b><small>${RARE[s.rarity] || 'Not found yet'}${only ? `. ${only}` : ''}</small></div>`;
            const stamps = (f.snows || []).map((k) => snowWords(k, hill.surface).emoji).join('');
            return `<div class="sb-card ${s.rarity}">
              <b>${MEDAL[f.badge] || ''} ${esc(s.name)}</b>
              <small>${RARE[s.rarity] ? `${RARE[s.rarity]} · ` : ''}${esc(BADGE_NAMES[f.badge] || '')} · found ${esc(fmtDay(f.day))}${stamps ? ` · ${stamps}` : ''}${f.best ? ` · ${f.best} s` : ''}</small>
              <p>${esc(s.fact)}</p>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
  openModal(`
    <div class="skibook" style="--kid:${esc(kid.color)}">
      <h2>📖 ${esc(kid.name)}'s shortcut book</h2>
      <p class="muted small">${found ? `${found} of ${total} hidden shortcuts found. 🥉 found it, 🥈 skied it clean, 🥇 skied it clean and won the race. Try each one on every kind of snow!` : `No shortcuts yet! Race a visiting buddy on skis and watch the edge of the trail for clues: tracks, a sparkle, a little sign or a gap in the trees (${total} to find).`}</p>
      ${pages}
      <button class="btn" data-action="modal-close">Close</button>
    </div>`);
}
