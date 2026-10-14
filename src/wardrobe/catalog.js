import { sv } from '../i18n/sv.js';

// Everything in the wardrobe, as plain data. Names are in src/i18n/sv.js,
// the 3D models in creatures/ and items.js. See README.md in this folder.
//
// Small things are bought with coins (`price`), earned by playing. Special things are
// goals (`need`) and cannot be bought:
//   stars: the player's total number of stars (playing a lot)
//   perfectRound: every answer right in one round
//   levels: this many levels with three stars (really knowing the facts)
// Entries with neither are free. The rules live in shop.js and unlocks.js.

// Fur colours, free to choose. `iris` is the eye colour that goes with a fur.
const CAT_FUR = {
  lila: { fur: 0xb58cf0, light: 0xf6eeff, dark: 0x7d4fc9, iris: ['#0f8f86', '#8ef5d6'] },
  rosa: { fur: 0xff9fcf, light: 0xfff1f8, dark: 0xe0559b, iris: ['#5a3fe0', '#bcaaff'] },
  vit: { fur: 0xfbf7ff, light: 0xffffff, dark: 0xc9bfdc, iris: ['#1f6fd6', '#9ad4ff'] },
  svart: { fur: 0x54486a, light: 0xf2ecff, dark: 0x2f2640, iris: ['#d18f00', '#ffe76a'] },
  orange: { fur: 0xffad5c, light: 0xfff2e0, dark: 0xe0791f, iris: ['#23924a', '#a8f2a2'] },
  gra: { fur: 0xa9b4c8, light: 0xf3f6fb, dark: 0x6f7c96, iris: ['#7a3fd0', '#d6adff'] },
};

// Colours for the other parts, the same for every creature and bought in the shop.
// Without one, a part keeps the colour the creature is drawn with.
const PART_COLORS = {
  eyes: {
    turkos: ['#0f8f86', '#8ef5d6'],
    bla: ['#1f6fd6', '#9ad4ff'],
    gron: ['#23924a', '#a8f2a2'],
    lila: ['#7a3fd0', '#d6adff'],
    rosa: ['#d63384', '#ffb3d9'],
    guld: ['#d18f00', '#ffe76a'],
    brun: ['#5a3418', '#c08a5a'],
  },
  paws: { vit: 0xffffff, rosa: 0xff9fcf, lila: 0xc7a6ff, bla: 0x8fd3ff, guld: 0xffc93c, svart: 0x3a3048 },
  nose: { rosa: 0xff7fae, rod: 0xff4f6d, lila: 0x9b5de5, bla: 0x4cc9f0, brun: 0x8d5a34, svart: 0x3a2a4d },
};

export const PALETTES = {
  catFur: CAT_FUR,
  // A real capybara's brown first, then the cat colours.
  capybaraFur: {
    brun: { fur: 0xdba46a, light: 0xf3d6ae, dark: 0x8d5a34, iris: ['#4a2a16', '#b07a4c'] },
    ...CAT_FUR,
  },
  ...PART_COLORS,
};

// The parts that can be painted, in the order the room shows them.
export const PARTS = ['fur', 'eyes', 'paws', 'nose'];

// One colour in the shop costs about one round of play.
const COLOR_PRICES = { eyes: 15, paws: 10, nose: 10 };
export const COLORS = Object.entries(PART_COLORS).flatMap(([part, palette]) =>
  Object.keys(palette).map((color) => ({ id: `${part}:${color}`, part, color, price: COLOR_PRICES[part] })),
);

// The animals a player can be. `paints` names the fur palette, `defaults` the fur
// colour it starts with, and `sound` the greeting in src/audio.js.
export const CREATURES = [
  { id: 'cat', paints: { fur: 'catFur' }, defaults: { fur: 'lila' }, sound: 'meow' },
  { id: 'capybara', paints: { fur: 'capybaraFur' }, defaults: { fur: 'brun' }, sound: 'squeak', need: { stars: 50 } },
];

// Things to wear. Each goes in a slot on the head (see the anchors in creatures/),
// and a creature wears at most one thing per slot.
export const ITEMS = [
  { id: 'bow', slot: 'ear', icon: '🎀', price: 30 },
  { id: 'flowers', slot: 'head', icon: '🌸', price: 50 },
  { id: 'glasses', slot: 'face', icon: '😎', price: 60 },
  { id: 'party', slot: 'head', icon: '🎉', need: { perfectRound: true } },
  { id: 'crown', slot: 'head', icon: '👑', need: { levels: 3 } },
  { id: 'wizard', slot: 'head', icon: '🧙', need: { levels: 6 } },
];

export const nameOf = (entry) => (entry.part ? sv.colors[entry.color] : sv.creatures[entry.id] ?? sv.items[entry.id]);
