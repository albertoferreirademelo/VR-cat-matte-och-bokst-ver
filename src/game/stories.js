import { sv } from '../i18n/sv.js';

// Räknesagor: now and then a rescue question is told as a short story instead of a sum,
// as in the grade-3 lessons on the four operations:
//   add    Clara har 8 fiskar och får 4 till.          8 fish and 4 more, then together
//   sub    Clara har 12 fiskar och ger bort 5.         12 fish, 5 swim away
//   mul    3 korgar med 4 fiskar i varje.              3 groups of 4, then together
//   share  12 fiskar delas lika mellan 3 kattungar.    dealt one at a time to each kitten
//   group  16 hjul, 4 på varje bil.                    4 at a time onto a new car
// The fact is the same item the learner picked, so its stats key does not change. Only facts
// small enough to show as things in the scene get a story (see src/game/storyScene.js).
// `start` and `end` are how many things are in each group before and after the meaning is shown.

export const STORY_CHANCE = 0.3; // per rescue question, never two in a row: about one in four
export const MAX_THINGS = 20;
export const MAX_GROUPS = 5;
const LINE = 26; // characters per line on the story board

const times = (count, value) => Array.from({ length: count }, () => value);

function options({ op, a, b, answer }) {
  const list = [];
  if (op === '+' && answer <= MAX_THINGS) list.push({ kind: 'add', things: ['fish', 'yarn'], start: [a, b], end: [answer] });
  if (op === '-' && a <= MAX_THINGS) list.push({ kind: 'sub', things: ['fish', 'yarn'], start: [a], end: [answer] });
  if (op === '*' && a >= 2 && b >= 2 && a <= MAX_GROUPS && answer <= MAX_THINGS) {
    list.push({ kind: 'mul', things: ['fish', 'yarn'], start: times(a, b), end: [answer] });
  }
  if (op === '/' && a <= MAX_THINGS && b >= 2) {
    if (b <= MAX_GROUPS) list.push({ kind: 'share', things: ['fish'], start: [a], end: times(b, answer) });
    if (answer <= MAX_GROUPS) list.push({ kind: 'group', things: b === 4 ? ['fish', 'wheel'] : ['fish'], start: [a], end: times(answer, b) });
  }
  return list;
}

// What holds each group in the scene: kittens for sharing, baskets, bowls or cars.
const HOLDERS = { mul: { fish: 'basket', yarn: 'kitten' }, share: { fish: 'kitten' }, group: { fish: 'bowl', wheel: 'car' } };

const pickFrom = (list, random) => list[Math.floor(random() * list.length)];

export const storyFits = (item) => options(item).length > 0;

function greedy(words, width) {
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  return [...lines, line];
}

// Splits the sentences into lines of at most `width` characters, each sentence on lines of its
// own, as evenly as it goes (no lonely "nu?" on a line).
export function wrap(sentences, width = LINE) {
  return sentences.flatMap((sentence) => {
    const words = sentence.split(' ');
    const count = greedy(words, width).length;
    let even = Math.ceil(sentence.length / count);
    while (greedy(words, even).length > count) even += 1;
    return greedy(words, even);
  });
}

// A story for a math fact, or null if the fact is too big to show.
export function makeStory(item, random = Math.random) {
  const list = options(item);
  if (list.length === 0) return null;
  const { kind, things, start, end } = pickFrom(list, random);
  const thing = pickFrom(things, random);
  const name = pickFrom(sv.story.names, random);
  const sentences = sv.story[kind][thing]({ name, a: item.a, b: item.b });
  return { kind, thing, holder: HOLDERS[kind]?.[thing] ?? null, sentences, lines: wrap(sentences), start, end };
}
