import { PALETTES } from './wardrobe/catalog.js';

// Every level has its own named kitten, held by the cloud troll in a golden bubble. Beating the
// troll on a level rescues it for good, and it joins the player's collection ("Mina kattungar").
// The bubble kittens rescued along the way are only counted (profile.kittens).
const NAMES = [
  'Smulan', 'Morris', 'Pricken', 'Kanel', 'Molly', 'Nisse', 'Luna', 'Bulle', 'Sotis', 'Tiger',
  'Mysan', 'Kexet', 'Pärlan', 'Stjärna', 'Tussan', 'Lakrits', 'Vanilj', 'Sockan', 'Tofsen', 'Glitter',
];
const FURS = Object.keys(PALETTES.catFur);
const EYES = Object.keys(PALETTES.eyes);

// The same kitten every time for a level, so it can be collected.
export function friendOf(deck, level) {
  const i = deck.levels.indexOf(level);
  return {
    id: level.id,
    name: NAMES[i % NAMES.length],
    look: { creature: 'cat', paint: { fur: FURS[(i * 5) % FURS.length], eyes: EYES[(i * 3 + 1) % EYES.length] }, wear: {} },
  };
}

export const friendsOf = (deck) => deck.levels.map((level) => friendOf(deck, level));

export const hasFriend = (profile, level) => (profile.friends ?? []).includes(level.id);

// Rescues a level's kitten. Returns true the first time.
export function rescueFriend(profile, level) {
  profile.friends ??= [];
  if (profile.friends.includes(level.id)) return false;
  profile.friends.push(level.id);
  return true;
}
