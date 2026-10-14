import { CREATURES, ITEMS } from './catalog.js';
import { DECKS } from '../decks/index.js';
import { levelStars } from '../learner.js';
import { sv } from '../i18n/sv.js';

// Everything that can be earned, in the order it is announced.
const EARNABLE = [...CREATURES, ...ITEMS].filter((entry) => entry.need);

const masteredLevels = (profile) =>
  DECKS[profile.track].levels.filter((level) => levelStars(profile, level) === 3).length;

function reached(profile, need, round) {
  if (need.stars != null) return profile.stars >= need.stars;
  if (need.perfectRound) return round?.perfect === true;
  if (need.levels != null) return masteredLevels(profile) >= need.levels;
  return false;
}

export const isUnlocked = (profile, entry) => !entry.need || profile.unlocked.includes(entry.id);

// What the lock on an entry says, with progress for goals that take a while.
export function lockText(profile, entry) {
  const { need } = entry;
  if (need.stars != null) return `${need.stars} ⭐`;
  if (need.perfectRound) return sv.goals.perfectRound;
  return `${sv.goals.levels(need.levels)} (${Math.min(masteredLevels(profile), need.levels)}/${need.levels})`;
}

// Unlocks everything the player has now earned and returns the new entries.
// Once unlocked an entry stays unlocked, even if a level later drops below three stars.
// `round` describes a round that just ended: { perfect }.
export function updateUnlocks(profile, round) {
  const fresh = [];
  for (const entry of EARNABLE) {
    if (isUnlocked(profile, entry) || !reached(profile, entry.need, round)) continue;
    profile.unlocked.push(entry.id);
    profile.fresh.push(entry.id);
    fresh.push(entry);
  }
  return fresh;
}
