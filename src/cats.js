// What a player's kitten can look like. Names are in src/i18n/sv.js.
export const CAT_COLORS = {
  lila: { fur: 0xb58cf0, light: 0xf6eeff, dark: 0x7d4fc9, iris: ['#0f8f86', '#8ef5d6'] },
  rosa: { fur: 0xff9fcf, light: 0xfff1f8, dark: 0xe0559b, iris: ['#5a3fe0', '#bcaaff'] },
  vit: { fur: 0xfbf7ff, light: 0xffffff, dark: 0xc9bfdc, iris: ['#1f6fd6', '#9ad4ff'] },
  svart: { fur: 0x54486a, light: 0xf2ecff, dark: 0x2f2640, iris: ['#d18f00', '#ffe76a'] },
  orange: { fur: 0xffad5c, light: 0xfff2e0, dark: 0xe0791f, iris: ['#23924a', '#a8f2a2'] },
  gra: { fur: 0xa9b4c8, light: 0xf3f6fb, dark: 0x6f7c96, iris: ['#7a3fd0', '#d6adff'] },
};

// Hats and other things to wear. `need` says how each one is unlocked:
//   stars: the player's total number of stars (playing a lot)
//   perfectRound: every answer right in one round
//   levels: this many levels with three stars (really knowing the facts)
// The rules live in src/rewards.js.
export const ACCESSORIES = [
  { id: 'none', icon: '🐱' },
  { id: 'bow', icon: '🎀', need: { stars: 10 } },
  { id: 'flowers', icon: '🌸', need: { stars: 30 } },
  { id: 'party', icon: '🎉', need: { perfectRound: true } },
  { id: 'glasses', icon: '😎', need: { stars: 100 } },
  { id: 'crown', icon: '👑', need: { levels: 3 } },
  { id: 'wizard', icon: '🧙', need: { levels: 6 } },
];

export const DEFAULT_LOOK = { color: 'lila', accessory: 'none' };
