// Draws a kid's buddy as an inline SVG string: background, species, mood face and outfit layers.
// Animation is done in CSS (see .buddy rules in style.css) using the classes set here.

const INK = '#3a2e4f';

const PALETTE = {
  fox: { main: '#f08a3c', dark: '#c25e1c', light: '#fff4e6', inner: '#5a3420' },
  bear: { main: '#b07443', dark: '#7a4a26', light: '#ecc9a2', inner: '#e8a77a' },
  panda: { main: '#ffffff', dark: '#2f2a36', light: '#ffffff', inner: '#2f2a36' },
  cat: { main: '#a6b1c6', dark: '#6f7b91', light: '#f3f5fa', inner: '#ffb3c6' },
  dino: { main: '#6cc56f', dark: '#3f9446', light: '#dcf5c9', inner: '#f7b538' },
};

let uidCounter = 0;

const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;

// ---------- backgrounds ----------

function background(id, u) {
  const sky = (a, b) => `<defs><linearGradient id="${u}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="200" height="200" fill="url(#${u}sky)"/>`;
  const stars = (color, pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`).join('');
  switch (id) {
    case 'bg-sunset':
      return `${sky('#845ef7', '#ff922b')}
        <circle cx="100" cy="150" r="46" fill="#ffd43b" opacity="0.9"/>
        <rect y="150" width="200" height="30" fill="#4dabf7"/>
        <path d="M0 158 Q50 152 100 158 T200 158" stroke="#a5d8ff" stroke-width="3" fill="none"/>
        <rect y="178" width="200" height="22" fill="#ffe8a3"/>`;
    case 'bg-ocean':
      return `${sky('#74c0fc', '#1864ab')}
        ${stars('rgba(255,255,255,0.55)', [[30, 40, 6], [40, 70, 4], [170, 30, 5], [160, 60, 3], [24, 110, 3], [180, 100, 4]])}
        <path d="M18 200 Q10 160 22 130 Q30 160 26 200Z" fill="#2f9e44"/>
        <path d="M176 200 Q186 166 172 140 Q168 170 170 200Z" fill="#2f9e44"/>
        <rect y="184" width="200" height="16" fill="#ffe8a3"/>`;
    case 'bg-space':
      return `${sky('#0b1026', '#2b2d6e')}
        ${stars('#ffffff', [[20, 20, 1.6], [50, 46, 1.2], [80, 14, 1.8], [150, 22, 1.4], [178, 60, 1.8], [30, 90, 1.2], [170, 120, 1.4], [12, 150, 1.8], [120, 40, 1], [190, 170, 1.2]])}
        <circle cx="165" cy="45" r="16" fill="#ff8787"/>
        <ellipse cx="165" cy="45" rx="27" ry="6" fill="none" stroke="#ffd8a8" stroke-width="3"/>
        <ellipse cx="100" cy="206" rx="140" ry="30" fill="#5c5f99"/>
        <circle cx="60" cy="190" r="5" fill="#4c4f86"/><circle cx="150" cy="186" r="4" fill="#4c4f86"/>`;
    case 'bg-castle':
      return `${sky('#d0bfff', '#fff0f6')}
        <g fill="#b197fc">
          <rect x="10" y="120" width="40" height="80"/><rect x="150" y="120" width="40" height="80"/>
          <rect x="40" y="140" width="120" height="60"/>
          <path d="M6 122 L30 92 L54 122Z M146 122 L170 92 L194 122Z"/>
        </g>
        <path d="M30 92 V76 L42 81 L30 86 M170 92 V76 L182 81 L170 86" stroke="#7048e8" stroke-width="2" fill="#f783ac"/>
        <rect y="190" width="200" height="10" fill="#8ce99a"/>`;
    case 'bg-volcano':
      return `${sky('#ffa94d', '#ffe8cc')}
        <path d="M110 170 L150 60 L166 60 L200 170Z" fill="#7a4a26"/>
        <path d="M150 60 Q158 50 166 60 L162 76 Q158 70 154 78Z" fill="#fa5252"/>
        <circle cx="152" cy="40" r="7" fill="#adb5bd" opacity="0.8"/><circle cx="162" cy="26" r="9" fill="#ced4da" opacity="0.7"/>
        <path d="M0 175 Q100 160 200 175 V200 H0Z" fill="#ffe066"/>
        <path d="M30 180 Q28 140 36 120" stroke="#8d5524" stroke-width="5" fill="none"/>
        <path d="M36 120 q-20 -4 -28 8 M36 120 q20 -6 26 6 M36 120 q-6 -18 -20 -18 M36 120 q8 -18 22 -14" stroke="#2f9e44" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    case 'bg-rainbow':
      return `${sky('#d0ebff', '#fff9db')}
        ${['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].map((c, i) => `<path d="M${10 + i * 9} 170 A${90 - i * 9} ${90 - i * 9} 0 0 1 ${190 - i * 9} 170" stroke="${c}" stroke-width="9" fill="none"/>`).join('')}
        <g fill="#fff"><circle cx="22" cy="168" r="14"/><circle cx="38" cy="172" r="12"/><circle cx="178" cy="168" r="14"/><circle cx="162" cy="172" r="12"/></g>
        <rect y="182" width="200" height="18" fill="#8ce99a"/>`;
    case 'bg-galaxy':
      return `${sky('#1a1033', '#5f3dc4')}
        ${stars('#ffd43b', [[24, 30, 2.4], [60, 18, 1.6], [150, 20, 2.2], [182, 50, 1.6], [16, 90, 1.8], [186, 110, 2.4], [40, 140, 1.4], [168, 160, 1.8], [100, 12, 1.4]])}
        <path d="M30 60 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z M170 80 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3Z" fill="#fff3bf"/>
        <ellipse cx="100" cy="200" rx="120" ry="22" fill="#fcc419" opacity="0.5"/>`;
    case 'bg-meadow':
    default:
      return `${sky('#a5d8ff', '#e7f5ff')}
        <circle cx="166" cy="36" r="16" fill="#ffe066"/>
        <g fill="#fff"><circle cx="34" cy="42" r="10"/><circle cx="46" cy="38" r="12"/><circle cx="58" cy="44" r="9"/></g>
        <ellipse cx="100" cy="214" rx="170" ry="54" fill="#8ce99a"/>
        <g><circle cx="24" cy="176" r="4" fill="#f783ac"/><circle cx="178" cy="182" r="4" fill="#ffd43b"/><circle cx="160" cy="170" r="3" fill="#ffffff"/><circle cx="40" cy="190" r="3" fill="#ffd43b"/></g>`;
  }
}

// ---------- species parts ----------

function tail(species, p) {
  switch (species) {
    case 'fox':
      return `<path d="M128 166 Q178 170 172 118 Q160 150 128 150Z" fill="${p.main}" ${S}/><path d="M168 128 Q174 120 172 118 Q170 140 158 148 Q166 138 168 128Z" fill="${p.light}"/>`;
    case 'cat':
      return `<path d="M130 170 Q172 170 160 128" stroke="${INK}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M130 170 Q172 170 160 128" stroke="${p.main}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
    case 'dino':
      return `<path d="M128 150 L182 178 L126 176Z" fill="${p.main}" ${S}/>`;
    default:
      return `<circle cx="134" cy="168" r="9" fill="${species === 'panda' ? p.dark : p.main}" ${S}/>`;
  }
}

function ears(species, p) {
  switch (species) {
    case 'fox':
      return `<path d="M60 66 L56 20 L94 46Z M140 66 L144 20 L106 46Z" fill="${p.main}" ${S}/><path d="M64 56 L62 32 L84 47Z M136 56 L138 32 L116 47Z" fill="${p.inner}"/>`;
    case 'cat':
      return `<path d="M60 66 L60 26 L92 46Z M140 66 L140 26 L108 46Z" fill="${p.main}" ${S}/><path d="M65 56 L65 36 L84 47Z M135 56 L135 36 L116 47Z" fill="${p.inner}"/>`;
    case 'bear':
      return `<circle cx="62" cy="52" r="17" fill="${p.main}" ${S}/><circle cx="138" cy="52" r="17" fill="${p.main}" ${S}/><circle cx="62" cy="53" r="8" fill="${p.inner}"/><circle cx="138" cy="53" r="8" fill="${p.inner}"/>`;
    case 'panda':
      return `<circle cx="62" cy="52" r="17" fill="${p.dark}" ${S}/><circle cx="138" cy="52" r="17" fill="${p.dark}" ${S}/>`;
    case 'dino':
      return `<path d="M72 50 L80 26 L90 46Z M90 44 L100 18 L110 44Z M110 46 L120 26 L128 50Z" fill="${p.inner}" ${S}/>`;
    default:
      return '';
  }
}

function faceBase(species, p) {
  let out = '';
  if (species === 'fox') out += `<path d="M58 96 Q66 128 100 130 Q134 128 142 96 Q122 112 100 104 Q78 112 58 96Z" fill="${p.light}"/>`;
  else if (species !== 'panda') out += `<ellipse cx="100" cy="110" rx="24" ry="17" fill="${p.light}"/>`;
  if (species === 'panda') out += `<ellipse cx="80" cy="88" rx="13" ry="16" transform="rotate(-25 80 88)" fill="${p.dark}"/><ellipse cx="120" cy="88" rx="13" ry="16" transform="rotate(25 120 88)" fill="${p.dark}"/>`;
  if (species === 'dino') out += `<circle cx="94" cy="102" r="2.2" fill="${INK}"/><circle cx="106" cy="102" r="2.2" fill="${INK}"/>`;
  else out += `<ellipse cx="100" cy="101" rx="7" ry="5" fill="${INK}"/>`;
  if (species === 'cat') out += `<path d="M70 106 L52 102 M70 112 L52 114 M130 106 L148 102 M130 112 L148 114" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  return out;
}

function eyes(mood, species) {
  const light = species === 'panda';
  const dot = (x) => `<circle cx="${x}" cy="88" r="6.5" fill="${light ? '#fff' : INK}"/>${light ? `<circle cx="${x}" cy="88" r="4" fill="${INK}"/>` : ''}<circle cx="${x - 2}" cy="86" r="2.2" fill="#fff"/>`;
  const arc = (x, up) => `<path d="M${x - 8} 90 Q${x} ${up ? 79 : 95} ${x + 8} 90" stroke="${light ? '#fff' : INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  switch (mood) {
    case 'excited':
      return arc(82, true) + arc(118, true);
    case 'sleepy':
      return arc(82, false) + arc(118, false);
    case 'sad':
      return `${dot(82)}${dot(118)}<path d="M72 76 L90 71 M128 76 L110 71" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M78 98 Q74 106 78 109 Q82 106 78 98Z" fill="#74c0fc" class="tear"/>`;
    case 'proud':
      return `${dot(82)}${dot(118)}<path d="M86 82 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5Z M122 82 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5Z" fill="#fff"/>`;
    default:
      return dot(82) + dot(118);
  }
}

function mouth(mood) {
  switch (mood) {
    case 'excited':
      return `<path d="M86 110 Q100 134 114 110Z" fill="#8a2a3a" ${S}/><ellipse cx="100" cy="122" rx="7" ry="4" fill="#ff8fa3"/>`;
    case 'proud':
      return `<path d="M86 109 Q100 126 114 109" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    case 'sleepy':
      return `<ellipse cx="100" cy="115" rx="4.5" ry="5.5" fill="#8a2a3a" stroke="${INK}" stroke-width="2"/>`;
    case 'sad':
      return `<path d="M90 119 Q100 109 110 119" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    default:
      return `<path d="M90 110 Q100 120 110 110" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }
}

// ---------- outfit ----------

function hat(id) {
  switch (id) {
    case 'hat-cap':
      return `<path d="M56 62 Q100 4 144 62Z" fill="#e03131" ${S}/><path d="M118 58 Q156 52 170 64 Q144 72 118 64Z" fill="#c92a2a" ${S}/><circle cx="100" cy="26" r="5" fill="#fff" ${S}/>`;
    case 'hat-party':
      return `<path d="M76 52 L100 -2 L124 52Z" fill="#845ef7" ${S}/><path d="M84 36 L114 30 M80 46 L120 40 M92 18 L108 14" stroke="#ffd43b" stroke-width="4"/><circle cx="100" cy="0" r="8" fill="#ffd43b" ${S}/>`;
    case 'hat-beanie':
      return `<path d="M56 60 Q100 -4 144 60Z" fill="#1c7ed6" ${S}/><rect x="52" y="50" width="96" height="16" rx="8" fill="#1864ab" ${S}/><circle cx="100" cy="10" r="10" fill="#fff" ${S}/>`;
    case 'hat-headphones':
      return `<path d="M52 86 Q52 24 100 24 Q148 24 148 86" stroke="${INK}" stroke-width="11" fill="none"/><path d="M52 86 Q52 24 100 24 Q148 24 148 86" stroke="#495057" stroke-width="6" fill="none"/><rect x="40" y="72" width="20" height="32" rx="8" fill="#e64980" ${S}/><rect x="140" y="72" width="20" height="32" rx="8" fill="#e64980" ${S}/>`;
    case 'hat-cowboy':
      return `<path d="M70 50 Q70 10 100 18 Q130 10 130 50Z" fill="#a0522d" ${S}/><path d="M36 50 Q100 70 164 50 Q160 62 100 66 Q40 62 36 50Z" fill="#8b4513" ${S}/><rect x="70" y="40" width="60" height="8" fill="#ffd43b"/>`;
    case 'hat-wizard':
      return `<path d="M66 56 Q90 30 96 -4 Q104 -10 112 0 Q112 30 134 56Z" fill="#5f3dc4" ${S}/><path d="M94 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z M112 38 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5Z" fill="#ffd43b"/><ellipse cx="100" cy="56" rx="50" ry="9" fill="#7048e8" ${S}/>`;
    case 'hat-tophat':
      return `<rect x="72" y="4" width="56" height="48" rx="4" fill="#212529" ${S}/><rect x="72" y="38" width="56" height="9" fill="#e03131"/><ellipse cx="100" cy="54" rx="44" ry="8" fill="#343a40" ${S}/>`;
    case 'hat-crown':
      return `<path d="M64 56 L62 20 L82 38 L100 10 L118 38 L138 20 L136 56Z" fill="#fcc419" stroke="#e67700" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="42" r="6" fill="#e64980"/><circle cx="78" cy="46" r="4" fill="#4dabf7"/><circle cx="122" cy="46" r="4" fill="#51cf66"/>`;
    default:
      return '';
  }
}

function faceItem(id) {
  const heart = (x) => `<path d="M${x} 98 C${x - 22} 84 ${x - 12} 70 ${x} 80 C${x + 12} 70 ${x + 22} 84 ${x} 98Z" fill="#f06595" opacity="0.9" ${S}/>`;
  const star = (x) => `<path d="M${x} 72 L${x + 5} 83 L${x + 16} 84 L${x + 8} 92 L${x + 10} 103 L${x} 97 L${x - 10} 103 L${x - 8} 92 L${x - 16} 84 L${x - 5} 83Z" fill="#fcc419" opacity="0.92" ${S}/>`;
  switch (id) {
    case 'face-round':
      return `<circle cx="82" cy="88" r="14" fill="rgba(255,255,255,0.2)" stroke="${INK}" stroke-width="4"/><circle cx="118" cy="88" r="14" fill="rgba(255,255,255,0.2)" stroke="${INK}" stroke-width="4"/><path d="M96 88 Q100 84 104 88" stroke="${INK}" stroke-width="4" fill="none"/>`;
    case 'face-sun':
      return `<rect x="64" y="78" width="34" height="22" rx="9" fill="#212529"/><rect x="102" y="78" width="34" height="22" rx="9" fill="#212529"/><path d="M98 84 H102 M58 82 L64 84 M142 82 L136 84" stroke="#212529" stroke-width="4"/><path d="M70 84 L78 84 M108 84 L116 84" stroke="#868e96" stroke-width="3" stroke-linecap="round"/>`;
    case 'face-heart':
      return `${heart(82)}${heart(118)}<path d="M96 86 H104" stroke="${INK}" stroke-width="3"/>`;
    case 'face-star':
      return `${star(82)}${star(118)}`;
    case 'face-pirate':
      return `<path d="M60 70 L148 100" stroke="${INK}" stroke-width="3"/><ellipse cx="118" cy="89" rx="13" ry="12" fill="#212529"/>`;
    default:
      return '';
  }
}

function neckBack(id) {
  if (id === 'neck-cape') return `<path d="M68 128 Q46 170 54 194 L146 194 Q154 170 132 128Z" fill="#e03131" ${S}/>`;
  return '';
}

function neckFront(id) {
  switch (id) {
    case 'neck-bowtie':
      return `<path d="M100 132 L80 122 L80 142Z M100 132 L120 122 L120 142Z" fill="#e03131" ${S}/><circle cx="100" cy="132" r="5" fill="#c92a2a" ${S}/>`;
    case 'neck-scarf':
      return `<rect x="66" y="122" width="68" height="16" rx="8" fill="#f76707" ${S}/><rect x="106" y="130" width="15" height="34" rx="5" fill="#f76707" ${S} transform="rotate(-10 113 130)"/><path d="M76 124 V136 M88 124 V136 M100 124 V136 M112 124 V136" stroke="#ffc078" stroke-width="3"/>`;
    case 'neck-medal':
      return `<path d="M84 122 L100 150 L116 122" stroke="#1c7ed6" stroke-width="6" fill="none"/><circle cx="100" cy="154" r="11" fill="#fcc419" stroke="#e67700" stroke-width="3"/><path d="M100 147 l2 4.5 4.5.5 -3.5 3 1 4.5 -4 -2.5 -4 2.5 1 -4.5 -3.5 -3 4.5 -.5Z" fill="#fff3bf"/>`;
    case 'neck-cape':
      return `<path d="M70 126 Q100 140 130 126" stroke="#c92a2a" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="100" cy="134" r="5" fill="#fcc419" ${S}/>`;
    case 'neck-necklace':
      return `<path d="M72 124 Q100 146 128 124" stroke="#fcc419" stroke-width="3" fill="none"/>${[[80, 131], [90, 136], [110, 136], [120, 131]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#fcc419"/>`).join('')}<path d="M100 134 L108 142 L100 152 L92 142Z" fill="#4dabf7" ${S}/>`;
    default:
      return '';
  }
}

function extras(mood) {
  if (mood === 'sleepy') {
    return `<g class="zzz" fill="${INK}" font-family="system-ui, sans-serif" font-weight="900"><text x="140" y="56" font-size="18">z</text><text x="152" y="40" font-size="14">z</text><text x="162" y="26" font-size="11">z</text></g>`;
  }
  if (mood === 'proud' || mood === 'excited') {
    const sp = (x, y, s) => `<path d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3}Z" fill="#ffd43b" stroke="#f08c00" stroke-width="1.5"/>`;
    return `<g class="sparkles">${sp(34, 60, 9)}${sp(168, 84, 11)}${sp(44, 140, 7)}${sp(160, 30, 6)}</g>`;
  }
  return '';
}

/**
 * buddy: { species, outfit: { background, hat, face, neck } }
 * mood: happy | excited | proud | sleepy | sad
 * opts.background: false to draw the character only (for small chips)
 */
export function buddySvg(buddy, mood = 'happy', opts = {}) {
  uidCounter += 1;
  const u = `b${uidCounter}`;
  const species = PALETTE[buddy?.species] ? buddy.species : 'bear';
  const p = PALETTE[species];
  const o = buddy?.outfit || {};
  const bodyFill = species === 'panda' ? p.main : p.main;
  const limb = species === 'panda' ? p.dark : p.main;
  const showBg = opts.background !== false;
  return `<svg class="buddy-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${species} buddy, ${mood}">
    ${showBg ? background(o.background, u) : ''}
    <ellipse cx="100" cy="192" rx="44" ry="6" fill="#000" opacity="0.15" class="shadow"/>
    <g class="char">
      ${neckBack(o.neck)}
      ${tail(species, p)}
      <ellipse cx="80" cy="184" rx="15" ry="9" fill="${limb}" ${S}/>
      <ellipse cx="120" cy="184" rx="15" ry="9" fill="${limb}" ${S}/>
      <ellipse cx="100" cy="152" rx="40" ry="34" fill="${bodyFill}" ${S}/>
      <ellipse cx="100" cy="158" rx="24" ry="22" fill="${species === 'panda' ? '#f1f3f5' : p.light}"/>
      <g class="arm arm-l"><ellipse cx="62" cy="150" rx="10" ry="18" transform="rotate(20 62 150)" fill="${limb}" ${S}/></g>
      <g class="arm arm-r"><ellipse cx="138" cy="150" rx="10" ry="18" transform="rotate(-20 138 150)" fill="${limb}" ${S}/></g>
      ${neckFront(o.neck)}
      <g class="head">
        ${ears(species, p)}
        <circle cx="100" cy="88" r="46" fill="${p.main}" ${S}/>
        ${faceBase(species, p)}
        <circle cx="68" cy="108" r="7" fill="#ff8fa3" opacity="${mood === 'sad' || mood === 'sleepy' ? 0.25 : 0.55}"/>
        <circle cx="132" cy="108" r="7" fill="#ff8fa3" opacity="${mood === 'sad' || mood === 'sleepy' ? 0.25 : 0.55}"/>
        <g class="eyes">${eyes(mood, species)}</g>
        ${mouth(mood)}
        ${faceItem(o.face)}
        ${hat(o.hat)}
      </g>
    </g>
    ${extras(mood)}
  </svg>`;
}

/** What the buddy says, by mood. */
export function buddyLine(mood, name) {
  const lines = {
    happy: [`Keep going, ${name}!`, "We're doing great!", 'What should we do next?'],
    excited: ['WOOHOO!', 'Yes! You did it!', 'High five! ✋'],
    proud: ['Quest complete! I’m so proud of you!', 'Best day ever!', "We did it! See you tomorrow!"],
    sleepy: ['Yawn... is it quest time?', "I'm bored... let's do a task!", 'Wake me up with a task!'],
    sad: ['I missed you yesterday...', "Let's get our streak going again!", "Today's a new day. Let's go!"],
  };
  const list = lines[mood] || lines.happy;
  // stable per day so it doesn't change on every redraw
  const i = (new Date().getDate() + name.length) % list.length;
  return list[i];
}
