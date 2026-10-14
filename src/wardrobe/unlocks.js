import { CREATURES, ITEMS, GEAR } from './catalog.js';
import { DECKS } from '../decks/index.js';
import { levelStars } from '../learner.js';
import { sv } from '../i18n/sv.js';

// Goals, in the order they are announced.
const GOALS = [...CREATURES, ...ITEMS, ...GEAR].filter((entry) => entry.need);

const masteredLevels = (profile) =>
  DECKS[profile.track].levels.filter((level) => levelStars(profile, level) === 3).length;

// How far a player has come towards a goal that takes a while, as { have, need }.
export function progressOf(profile, entry) {
  const { need } = entry;
  if (need.stars != null) return { have: Math.min(profile.stars, need.stars), need: need.stars };
  if (need.levels != null) return { have: Math.min(masteredLevels(profile), need.levels), need: need.levels };
  return null;
}

function reached(profile, need, round) {
  if (need.perfectRound) return round?.perfect === true;
  const progress = progressOf(profile, { need });
  return progress != null && progress.have >= progress.need;
}

// Free entries are everyone's; the rest once bought or earned.
export const owns = (profile, entry) => (!entry.need && !entry.price) || profile.unlocked.includes(entry.id);

// What a goal asks for, with progress for goals that take a while.
export function goalText(profile, entry) {
  const { need } = entry;
  if (need.perfectRound) return sv.goals.perfectRound;
  const { have } = progressOf(profile, entry);
  return need.stars != null ? sv.goals.stars(have, need.stars) : sv.goals.levels(have, need.levels);
}

// Unlocks every goal the player has now reached and returns the new entries.
// Once unlocked an entry stays unlocked, even if a level later drops below three stars.
// `round` describes a round that just ended: { perfect }.
export function updateUnlocks(profile, round) {
  const fresh = [];
  for (const entry of GOALS) {
    if (owns(profile, entry) || !reached(profile, entry.need, round)) continue;
    profile.unlocked.push(entry.id);
    profile.fresh.push(entry.id);
    fresh.push(entry);
  }
  return fresh;
}
