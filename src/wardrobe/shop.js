import { owns } from './unlocks.js';

// Coins are earned by finishing a round and spent in the room on things with a `price`.
// Stars are never spent: they show how much a player has practised.
const PER_RIGHT_ANSWER = 1;
const PERFECT_BONUS = 5;

// Pays for a finished round and returns how many coins it gave.
export function payRound(profile, { correct, perfect }) {
  const coins = correct * PER_RIGHT_ANSWER + (perfect ? PERFECT_BONUS : 0);
  profile.coins += coins;
  return coins;
}

export const canBuy = (profile, entry) => entry.price != null && !owns(profile, entry) && profile.coins >= entry.price;

// Buys an entry if the player has the coins. Returns whether it was bought.
export function buy(profile, entry) {
  if (!canBuy(profile, entry)) return false;
  profile.coins -= entry.price;
  profile.unlocked.push(entry.id);
  return true;
}
