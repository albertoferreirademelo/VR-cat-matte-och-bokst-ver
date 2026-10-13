import { mathDeck } from './math.js';
import { lettersDeck } from './letters.js';

// A deck is one kind of game for a profile.
//   id, name       what it is called
//   levels         [{ id, name, badge, color, items }]
//   items          [{ key, answer, prompt?, sound? }]; `sound` is a voice clip that asks the question
//   distractors    (item, count, level) => wrong answers for the other balloons
//   ask, tell      (item) => text on the sign before and after the answer
//   timed          false: balloons wait instead of falling (default true)
//   fastMs         answers within this time count as known by heart
//   roundLength    questions per round
//   soundboard     true: the menu offers a page to hear every item
export const DECKS = {
  [mathDeck.id]: mathDeck,
  [lettersDeck.id]: lettersDeck,
};

export const UPCOMING_DECKS = ['Ord'];
