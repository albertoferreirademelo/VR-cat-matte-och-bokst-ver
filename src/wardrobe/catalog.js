import { sv } from '../i18n/sv.js';

// Everything in the wardrobe, as plain data. Names are in src/i18n/sv.js,
// the 3D models in creatures/ and items.js. See README.md in this folder.
//
// `need` says how an entry is unlocked:
//   stars: the player's total number of stars (playing a lot)
//   perfectRound: every answer right in one round
//   levels: this many levels with three stars (really knowing the facts)
// The rules live in unlocks.js.

// Colours for the parts that can be painted. `iris` is the eye colour that goes with a fur.
const CAT_FUR = {
  lila: { fur: 0xb58cf0, light: 0xf6eeff, dark: 0x7d4fc9, iris: ['#0f8f86', '#8ef5d6'] },
  rosa: { fur: 0xff9fcf, light: 0xfff1f8, dark: 0xe0559b, iris: ['#5a3fe0', '#bcaaff'] },
  vit: { fur: 0xfbf7ff, light: 0xffffff, dark: 0xc9bfdc, iris: ['#1f6fd6', '#9ad4ff'] },
  svart: { fur: 0x54486a, light: 0xf2ecff, dark: 0x2f2640, iris: ['#d18f00', '#ffe76a'] },
  orange: { fur: 0xffad5c, light: 0xfff2e0, dark: 0xe0791f, iris: ['#23924a', '#a8f2a2'] },
  gra: { fur: 0xa9b4c8, light: 0xf3f6fb, dark: 0x6f7c96, iris: ['#7a3fd0', '#d6adff'] },
};

export const PALETTES = {
  catFur: CAT_FUR,
  // A real capybara's brown first, then the cat colours.
  capybaraFur: {
    brun: { fur: 0xdba46a, light: 0xf3d6ae, dark: 0x8d5a34, iris: ['#4a2a16', '#b07a4c'] },
    ...CAT_FUR,
  },
};

// The animals a player can be. `paints` names the palette for each part that
// can be coloured, `defaults` the colour each part starts with, and `sound` the
// greeting in src/audio.js.
export const CREATURES = [
  { id: 'cat', paints: { fur: 'catFur' }, defaults: { fur: 'lila' }, sound: 'meow' },
  { id: 'capybara', paints: { fur: 'capybaraFur' }, defaults: { fur: 'brun' }, sound: 'squeak', need: { stars: 50 } },
];

// Things to wear. Each goes in a slot on the head (see the anchors in creatures/),
// and a creature wears at most one thing per slot.
export const ITEMS = [
  { id: 'bow', slot: 'ear', icon: '🎀', need: { stars: 10 } },
  { id: 'flowers', slot: 'head', icon: '🌸', need: { stars: 30 } },
  { id: 'party', slot: 'head', icon: '🎉', need: { perfectRound: true } },
  { id: 'glasses', slot: 'face', icon: '😎', need: { stars: 100 } },
  { id: 'crown', slot: 'head', icon: '👑', need: { levels: 3 } },
  { id: 'wizard', slot: 'head', icon: '🧙', need: { levels: 6 } },
];

export const nameOf = (entry) => sv.creatures[entry.id] ?? sv.items[entry.id];
