import { withMasterRounds } from './master.js';

// The math deck: levels are small families of facts, ordered from easy to hard.
const OPS = {
  '+': { symbol: '+', apply: (a, b) => a + b },
  '-': { symbol: '−', apply: (a, b) => a - b },
  '*': { symbol: '·', apply: (a, b) => a * b },
  '/': { symbol: '/', apply: (a, b) => a / b },
};

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function facts(op, as, bs, keep = () => true) {
  const items = [];
  for (const a of as) {
    for (const b of bs) {
      if (!keep(a, b)) continue;
      items.push({
        key: `${a}${op}${b}`,
        a,
        b,
        op,
        prompt: `${a} ${OPS[op].symbol} ${b}`,
        answer: OPS[op].apply(a, b),
      });
    }
  }
  return items;
}

// Division as the times tables backwards: 12 / 3 = 4 because 3 · 4 = 12.
function divisions(set) {
  return set.flatMap((b) => facts('/', range(1, 10).map((answer) => answer * b), [b], (a) => a % b === 0));
}

function tables(set) {
  const all = [...facts('*', set, range(1, 10)), ...facts('*', range(1, 10), set)];
  return [...new Map(all.map((item) => [item.key, item])).values()];
}

const LEVELS = withMasterRounds([
  {
    id: 'add-1-2',
    badge: '+1',
    color: 'pink',
    name: 'Plus 1 och 2',
    items: facts('+', range(1, 9), range(1, 9), (a, b) => a + b <= 10 && (a <= 2 || b <= 2)),
  },
  {
    id: 'add-doubles',
    badge: '4+4',
    color: 'pink',
    name: 'Dubblor',
    items: facts('+', range(1, 10), range(1, 10), (a, b) => a === b),
  },
  {
    id: 'add-ten',
    badge: '10',
    color: 'pink',
    name: 'Tiokompisar',
    items: facts('+', range(1, 9), range(1, 9), (a, b) => a + b === 10),
  },
  {
    id: 'add-10',
    badge: '+',
    color: 'pink',
    name: 'Plus upp till 10',
    items: facts('+', range(1, 9), range(1, 9), (a, b) => a + b <= 10),
  },
  {
    id: 'add-near-doubles',
    badge: '4+5',
    color: 'pink',
    name: 'Nästan dubblor',
    items: facts('+', range(1, 10), range(1, 10), (a, b) => Math.abs(a - b) === 1),
  },
  {
    id: 'add-20',
    badge: '+20',
    color: 'pink',
    name: 'Plus upp till 20',
    items: facts('+', range(2, 9), range(2, 9), (a, b) => a + b > 10),
  },
  {
    id: 'sub-10',
    badge: '−',
    color: 'blue',
    name: 'Minus upp till 10',
    items: facts('-', range(2, 10), range(1, 9), (a, b) => a > b),
  },
  {
    id: 'sub-20',
    badge: '−20',
    color: 'blue',
    name: 'Minus upp till 20',
    items: facts('-', range(11, 18), range(2, 9), (a, b) => a - b >= 2 && a - b <= 9),
  },
  { id: 'mul-2-5-10', badge: '·2', color: 'orange', name: 'Gånger 2, 5 och 10', items: tables([2, 5, 10]) },
  { id: 'mul-3-4', badge: '·3', color: 'orange', name: 'Gånger 3 och 4', items: tables([3, 4]) },
  { id: 'mul-6-9', badge: '·9', color: 'orange', name: 'Gånger 6, 7, 8 och 9', items: tables([6, 7, 8, 9]) },
  { id: 'div-2-5-10', badge: '/2', color: 'green', name: 'Delat med 2, 5 och 10', items: divisions([2, 5, 10]) },
  { id: 'div-3-4', badge: '/3', color: 'green', name: 'Delat med 3 och 4', items: divisions([3, 4]) },
  { id: 'div-6-9', badge: '/9', color: 'green', name: 'Delat med 6, 7, 8 och 9', items: divisions([6, 7, 8, 9]) },
]);

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// Wrong answers are near misses, so guessing or miscounting by one does not pay off.
function distractors(item, count) {
  const { a, b, answer } = item;
  const near =
    item.op === '*'
      ? [a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b]
      : [answer - 1, answer + 1, answer - 2, answer + 2];
  // Dividing by mistake with the wrong table, or multiplying instead, are tempting wrong answers.
  const far =
    item.op === '*'
      ? [answer - 1, answer + 1, answer + 2, answer - 2]
      : item.op === '/'
        ? [answer + 3, answer - 3, b]
        : [answer + 10, answer - 10, answer + 3];
  const picked = [];
  for (const value of [...shuffle(near), ...far]) {
    if (value < (item.op === '/' ? 1 : 0) || value === answer || picked.includes(value)) continue;
    picked.push(value);
    if (picked.length === count) break;
  }
  return picked;
}

export const mathDeck = {
  id: 'matte',
  name: 'Matte',
  adventure: true, // played as the kitten rescue in src/game/adventure.js
  levels: LEVELS,
  distractors,
  ask: (item) => `${item.prompt} = ?`,
  tell: (item) => `${item.prompt} = ${item.answer}`,
};
