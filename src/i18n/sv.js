// All text the players see. Keep it here so new words are easy to add or change.
export const sv = {
  title: 'Kattmatte',
  whoPlays: 'Vem spelar?',
  newPlayer: '+ Ny spelare',
  yourName: 'Vad heter du?',
  pickCat: 'Välj din katt',
  whatGame: 'Vad vill du spela?',
  save: 'Klar!',
  cancel: 'Avbryt',
  hello: (name) => `Hej ${name}!`,
  whatPractice: 'Vad vill du öva på?',
  wardrobe: 'Kattens garderob',
  startXR: 'Starta med VR-glasögon',
  startScreen: 'Spela på skärmen',
  switchPlayer: 'Byt spelare',
  deletePlayer: 'Ta bort spelare',
  confirmDelete: (name) => `Vill du ta bort ${name}? Alla stjärnor försvinner.`,
  xrFailed: 'Det gick inte att starta VR. Försök igen.',
  how: {
    matte: {
      xr: 'Sikta med trollstaven och tryck på avtryckaren för att smälla rätt ballong.',
      screen: 'Klicka på ballongen med rätt svar.',
    },
    bokstaver: {
      xr: 'Lyssna och smäll rätt bokstav. Skjut på skylten för att höra igen.',
      screen: 'Lyssna och klicka på rätt bokstav. Klicka på skylten för att höra igen.',
    },
  },
  listen: '🔊 Lyssna på bokstäverna',
  listenHint: 'Tryck på en bokstav för att höra den.',
  back: 'Tillbaka',
  voiceCredit: 'Röst: Sertion, Wikimedia Commons (CC BY-SA 3.0)',
  exit: 'Avsluta',
  comingSoon: 'kommer snart',

  catColors: { lila: 'Lila', rosa: 'Rosa', vit: 'Vit', svart: 'Svart', orange: 'Orange', gra: 'Grå' },
  accessories: {
    none: 'Inget',
    bow: 'Rosett',
    flowers: 'Blomsterkrans',
    party: 'Partyhatt',
    glasses: 'Solglasögon',
    crown: 'Krona',
    wizard: 'Trollhatt',
  },

  // What a locked wardrobe item asks for.
  goals: {
    perfectRound: 'Alla rätt i en runda',
    levels: (count) => `★★★ på ${count} nivåer`,
  },
  newTag: 'Ny!',
  unlocked: (names) => `Nytt: ${names.join(' och ')}!`,

  praise: ['Bra jobbat!', 'Du är grym!', 'Helt rätt!', 'Snyggt!', 'Superbra!', 'Vilken stjärna!', 'Toppen!', 'Wow!'],
  encourage: ['Nästan!', 'Du klarar det!', 'Bra försök!', 'Vi tar den igen!'],
  streak: (count) => `${count} i rad!`,

  result: (correct, total) => `${correct} av ${total} rätt!`,
  resultPraise: (ratio) => (ratio >= 0.9 ? 'Fantastiskt!' : ratio >= 0.6 ? 'Bra jobbat!' : 'Bra kämpat!'),
  again: 'Spela igen',
  quit: 'Sluta',
};
