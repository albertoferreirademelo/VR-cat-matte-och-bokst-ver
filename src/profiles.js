import { newLook, upgradeLook } from './wardrobe/look.js';
import { updateUnlocks } from './wardrobe/unlocks.js';
import { updateLetterUnlocks } from './decks/letters.js';

// Player profiles, kept in the browser's local storage on the device that plays.
const KEY = 'kattmatte.v1';

function read() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(KEY));
  } catch {
    data = null;
  }
  data ??= { profiles: [] };
  // Profiles saved by an older version get the fields that were added since.
  for (const profile of data.profiles) {
    upgradeLook(profile);
    profile.unlocked ??= [];
    profile.fresh ??= [];
    profile.lastLevels ??= { [profile.track]: profile.lastLevel };
    profile.letterModes ??= {};
    updateLetterUnlocks(profile);
    updateUnlocks(profile);
  }
  return data;
}

const data = read();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked (private window); the game still works for the session.
  }
}

export const listProfiles = () => data.profiles;

export function createProfile(name, track, look) {
  const profile = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    track,
    look: newLook(look), // the pet: see src/wardrobe/look.js
    stars: 0,
    unlocked: [], // ids of the wardrobe entries earned so far
    fresh: [], // earned but not yet tried on, shown as new in the wardrobe
    stats: {}, // item key -> { box, seen, right, ms }
    pace: {}, // level id -> seconds a balloon takes to come down
    lastLevel: null,
    lastLevels: {}, // most recent level in each subject
    letterModes: {}, // letter group -> both, upper or lower
    letterUnlocks: [],
  };
  data.profiles.push(profile);
  save();
  return profile;
}

export function selectTrack(profile, track) {
  profile.lastLevels ??= { [profile.track]: profile.lastLevel };
  profile.lastLevels[profile.track] = profile.lastLevel;
  profile.track = track;
  profile.lastLevel = profile.lastLevels[track] ?? null;
  save();
}

export function deleteProfile(id) {
  data.profiles = data.profiles.filter((p) => p.id !== id);
  save();
}
