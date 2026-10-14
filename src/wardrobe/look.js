import { CREATURES, ITEMS, PALETTES } from './catalog.js';

// A look is what a player's pet is and wears:
//   { creature: 'cat', paint: { fur: 'lila', eyes: 'gron' }, wear: { head: 'crown', face: 'glasses' } }
// `paint` maps a part to a colour id from that part's palette (a part left out keeps the
// creature's own colour), and `wear` maps a slot to an item id.
export const DEFAULT_LOOK = { creature: 'cat', paint: { fur: 'lila' }, wear: {} };

export const newLook = (look = DEFAULT_LOOK) => structuredClone(look);

export const creatureOf = (look) => CREATURES.find((creature) => creature.id === look.creature) ?? CREATURES[0];

export const paletteOf = (look, part = 'fur') => PALETTES[creatureOf(look).paints[part] ?? part];

// All the colours a look is painted in: the fur's { fur, light, dark, iris }, with the eyes
// replaced if painted, and `paws` and `nose` when painted (otherwise the creature decides).
export function paintOf(look) {
  const furs = paletteOf(look);
  const fur = furs[look.paint?.fur] ?? furs[creatureOf(look).defaults.fur];
  const chosen = (part) => PALETTES[part][look.paint?.[part]];
  return { ...fur, iris: chosen('eyes') ?? fur.iris, paws: chosen('paws'), nose: chosen('nose') };
}

// The look with one catalog entry put on: a creature, a colour or a thing to wear.
export function dressedIn(look, entry) {
  if (CREATURES.includes(entry)) return asCreature(look, entry.id);
  if (entry.part) return { ...look, paint: { ...look.paint, [entry.part]: entry.color } };
  return { ...look, wear: { ...look.wear, [entry.slot]: entry.id } };
}

export function isWearing(look, entry) {
  if (CREATURES.includes(entry)) return look.creature === entry.id;
  if (entry.part) return look.paint[entry.part] === entry.color;
  return look.wear[entry.slot] === entry.id;
}

// A look as another creature, in that creature's own fur, keeping everything else.
export function asCreature(look, id) {
  const creature = CREATURES.find((entry) => entry.id === id);
  return { ...look, creature: id, paint: { ...look.paint, fur: creature.defaults.fur } };
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
