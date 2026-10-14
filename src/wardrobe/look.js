import { CREATURES, ITEMS, PALETTES } from './catalog.js';

// A look is what a player's pet is and wears:
//   { creature: 'cat', paint: { fur: 'lila' }, wear: { head: 'crown', face: 'glasses' } }
// `paint` maps a part to a colour id from that part's palette, `wear` maps a slot to an item id.
export const DEFAULT_LOOK = { creature: 'cat', paint: { fur: 'lila' }, wear: {} };

export const newLook = (look = DEFAULT_LOOK) => structuredClone(look);

export const creatureOf = (look) => CREATURES.find((creature) => creature.id === look.creature) ?? CREATURES[0];

export const paletteOf = (look, part = 'fur') => PALETTES[creatureOf(look).paints[part]];

// The colours of one part, or the creature's default when the saved colour is unknown.
export function colorsOf(look, part = 'fur') {
  const palette = paletteOf(look, part);
  return palette[look.paint?.[part]] ?? palette[creatureOf(look).defaults[part]];
}

export const isWorn = (look, item) => look.wear[item.slot] === item.id;

// A look as another creature, in that creature's own colours, keeping what it wears.
export function asCreature(look, id) {
  const creature = CREATURES.find((entry) => entry.id === id);
  return { ...look, creature: id, paint: { ...creature.defaults } };
}

// The outfit for the party at the end of a round: whatever was just earned, or else a party hat.
// A new creature comes to its own party.
export function partyLook(look, earned) {
  const item = earned.find((entry) => ITEMS.includes(entry)) ?? ITEMS.find((entry) => entry.id === 'party');
  const creature = earned.find((entry) => CREATURES.includes(entry));
  return { ...(creature ? asCreature(look, creature.id) : look), wear: { [item.slot]: item.id } };
}

// Profiles saved before the wardrobe had creatures kept `cat: { color, accessory }`.
export function upgradeLook(profile) {
  if (!profile.look) {
    const { color, accessory } = profile.cat ?? {};
    const item = ITEMS.find((entry) => entry.id === accessory);
    profile.look = newLook();
    if (color) profile.look.paint.fur = color;
    if (item) profile.look.wear[item.slot] = item.id;
  }
  delete profile.cat;
  profile.look.paint ??= {};
  profile.look.wear ??= {};
}
