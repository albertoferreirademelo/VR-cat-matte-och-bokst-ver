import { ACCESSORIES } from './cats.js';
import { DECKS } from './decks/index.js';
import { levelStars } from './learner.js';
import { sv } from './i18n/sv.js';

const masteredLevels = (profile) =>
  DECKS[profile.track].levels.filter((level) => levelStars(profile, level) === 3).length;

function reached(profile, need, round) {
  if (!need) return true;
  if (need.stars != null) return profile.stars >= need.stars;
  if (need.perfectRound) return round?.perfect === true;
  if (need.levels != null) return masteredLevels(profile) >= need.levels;
  return false;
}

export const isUnlocked = (profile, item) => !item.need || profile.unlocked.includes(item.id);

// What the lock on an item says, with progress for goals that take a while.
export function lockText(profile, item) {
  const { need } = item;
  if (need.stars != null) return `${need.stars} ⭐`;
  if (need.perfectRound) return sv.goals.perfectRound;
  return `${sv.goals.levels(need.levels)} (${Math.min(masteredLevels(profile), need.levels)}/${need.levels})`;
}

// Unlocks everything the player has now earned and returns the new items.
// Once unlocked an item stays unlocked, even if a level later drops below three stars.
// `round` describes a round that just ended: { perfect }.
export function updateUnlocks(profile, round) {
  const fresh = [];
  for (const item of ACCESSORIES) {
    if (isUnlocked(profile, item) || !reached(profile, item.need, round)) continue;
    profile.unlocked.push(item.id);
    profile.fresh.push(item.id);
    fresh.push(item);
  }
  return fresh;
}
