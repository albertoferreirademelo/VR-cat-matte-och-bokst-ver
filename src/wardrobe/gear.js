// The player's things in the game, next to the pet's look:
//   { wand: 'wizard', balloon: 'mix', stick: 'rosa', glitter: 'regnbage', ribbon: 'guld' }
// `wand` and `balloon` pick a kind; `stick`, `glitter` and `ribbon` decorate any wand and
// may be left out, so the wand keeps its own colours (and has no ribbon).
export const DEFAULT_GEAR = { wand: 'star', balloon: 'mix' };

export const newGear = () => ({ ...DEFAULT_GEAR });

// The gear with one catalog entry put to use.
export const withGear = (gear, entry) => ({ ...gear, [entry.slot]: entry.value });

export const isUsing = (gear, entry) => gear[entry.slot] === entry.value;
