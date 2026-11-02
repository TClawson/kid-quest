// Buddy species, wardrobe items and the rules for unlocking them. Pure data + logic, no DOM.

export const SPECIES = [
  { id: 'fox', name: 'Fox' },
  { id: 'bear', name: 'Bear' },
  { id: 'panda', name: 'Panda' },
  { id: 'cat', name: 'Cat' },
  { id: 'dino', name: 'Dino' },
];

export const SLOTS = [
  { id: 'background', name: 'Places', icon: '🏞️' },
  { id: 'hat', name: 'Hats', icon: '🎩' },
  { id: 'face', name: 'Glasses', icon: '🕶️' },
  { id: 'neck', name: 'Extras', icon: '🎀' },
];

// need: { streak: n } uses the kid's BEST streak ever, so a broken streak never takes items away.
// need: { level: n } uses the XP level. Items with no need are free from the start.
export const ITEMS = [
  { id: 'bg-meadow', slot: 'background', name: 'Sunny meadow' },
  { id: 'bg-sunset', slot: 'background', name: 'Sunset beach', need: { streak: 3 } },
  { id: 'bg-ocean', slot: 'background', name: 'Under the sea', need: { level: 5 } },
  { id: 'bg-space', slot: 'background', name: 'Outer space', need: { streak: 14 } },
  { id: 'bg-castle', slot: 'background', name: 'Castle', need: { streak: 30 } },
  { id: 'bg-volcano', slot: 'background', name: 'Volcano island', need: { level: 15 } },
  { id: 'bg-rainbow', slot: 'background', name: 'Rainbow land', need: { streak: 60 } },
  { id: 'bg-galaxy', slot: 'background', name: 'Golden galaxy', need: { streak: 100 } },

  { id: 'hat-cap', slot: 'hat', name: 'Ball cap', need: { level: 2 } },
  { id: 'hat-party', slot: 'hat', name: 'Party hat', need: { streak: 5 } },
  { id: 'hat-beanie', slot: 'hat', name: 'Beanie', need: { level: 4 } },
  { id: 'hat-headphones', slot: 'hat', name: 'Headphones', need: { level: 7 } },
  { id: 'hat-cowboy', slot: 'hat', name: 'Cowboy hat', need: { streak: 10 } },
  { id: 'hat-wizard', slot: 'hat', name: 'Wizard hat', need: { streak: 21 } },
  { id: 'hat-tophat', slot: 'hat', name: 'Top hat', need: { level: 12 } },
  { id: 'hat-crown', slot: 'hat', name: 'Crown', need: { streak: 30 } },

  { id: 'face-round', slot: 'face', name: 'Round glasses', need: { level: 3 } },
  { id: 'face-sun', slot: 'face', name: 'Sunglasses', need: { streak: 7 } },
  { id: 'face-heart', slot: 'face', name: 'Heart glasses', need: { level: 10 } },
  { id: 'face-star', slot: 'face', name: 'Star glasses', need: { streak: 14 } },
  { id: 'face-pirate', slot: 'face', name: 'Pirate patch', need: { level: 15 } },

  { id: 'neck-bowtie', slot: 'neck', name: 'Bow tie', need: { streak: 2 } },
  { id: 'neck-scarf', slot: 'neck', name: 'Cozy scarf', need: { level: 6 } },
  { id: 'neck-medal', slot: 'neck', name: 'Gold medal', need: { streak: 7 } },
  { id: 'neck-cape', slot: 'neck', name: 'Hero cape', need: { streak: 14 } },
  { id: 'neck-necklace', slot: 'neck', name: 'Gem necklace', need: { level: 20 } },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id);

export function isUnlocked(item, progress) {
  if (!item.need) return true;
  if (item.need.streak) return progress.best >= item.need.streak;
  if (item.need.level) return progress.level >= item.need.level;
  return false;
}

export function needLabel(item) {
  if (!item.need) return 'Free';
  if (item.need.streak) return `${item.need.streak}-day streak`;
  return `Level ${item.need.level}`;
}

/** Newly unlocked item ids that the kid hasn't been shown yet. */
export function newUnlocks(kid, progress) {
  const seen = new Set(kid.seenUnlocks || []);
  return ITEMS.filter((i) => i.need && isUnlocked(i, progress) && !seen.has(i.id)).map((i) => i.id);
}

/** Map an old emoji avatar to a species, for kids created before buddies existed. */
export function speciesFromEmoji(emoji) {
  return { '🦊': 'fox', '🐼': 'panda', '🐱': 'cat', '🦖': 'dino', '🐲': 'dino', '🐻': 'bear', '🐨': 'bear' }[emoji] || 'bear';
}

export function defaultBuddy(species = 'fox') {
  return { species, outfit: { background: 'bg-meadow' } };
}

/**
 * The buddy's resting mood for the quest screen.
 * proud: today is done. sad: missed yesterday (not frozen or excused) and nothing done yet today.
 * sleepy: nothing done yet today. happy: some progress.
 */
export function restingMood({ todayDone, todayComplete, missedYesterday }) {
  if (todayComplete) return 'proud';
  if (todayDone === 0 && missedYesterday) return 'sad';
  if (todayDone === 0) return 'sleepy';
  return 'happy';
}
