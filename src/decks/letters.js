// The letters deck: hear a letter, find it among the balloons.
// The voice says the letter's name. For the vowels that is also their long sound.
// The recording has no w, so w is left out for now.
const FILE_NAMES = { å: 'aa', ä: 'ae', ö: 'oe' };

const letter = (char) => ({
  key: char,
  answer: char.toUpperCase() + char, // shown as "Mm": capital and small letter together
  sound: `sv/letters/${FILE_NAMES[char] ?? char}`,
});

function group(id, color, chars, badge = chars[0].toUpperCase(), name = [...chars.toUpperCase()].join(' ')) {
  return { id, color, badge, name, items: [...chars].map(letter) };
}

// A few letters at a time, in roughly the order Swedish beginner books use:
// common letters whose sounds are easy to hear come first.
const LEVELS = [
  group('letters-1', 'pink', 'osalm'),
  group('letters-2', 'pink', 'eirnv'),
  group('letters-3', 'pink', 'tdkgh'),
  group('letters-4', 'pink', 'ufpbå'),
  group('letters-5', 'pink', 'äöyj'),
  group('letters-6', 'pink', 'cxzq'),
  group('vowels', 'blue', 'aeiouyåäö', 'Å', 'Vokaler'),
  group('all', 'orange', 'abcdefghijklmnopqrstuvxyzåäö', 'A–Ö', 'Alla bokstäver'),
];

// Wrong answers are other letters from the same level, so she only chooses
// among letters she is practising.
function distractors(item, count, level) {
  const others = level.items.filter((other) => other.key !== item.key);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return others.slice(0, count).map((other) => other.answer);
}

export const lettersDeck = {
  id: 'bokstaver',
  name: 'Bokstäver',
  levels: LEVELS,
  distractors,
  timed: false, // balloons float and wait; no hurry for a beginner
  fastMs: Infinity, // every right answer counts as known, however long it took
  roundLength: 8,
  soundboard: true, // the menu offers a page to tap and hear every letter
  ask: () => '',
  tell: (item) => item.answer,
};
