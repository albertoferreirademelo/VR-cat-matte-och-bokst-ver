import test from 'node:test';
import assert from 'node:assert/strict';
import { mathDeck } from '../src/decks/math.js';
import { makeStory, storyFits, wrap, MAX_THINGS, MAX_GROUPS } from '../src/game/stories.js';

const facts = [...new Map(mathDeck.levels.flatMap((level) => level.items).map((item) => [item.key, item])).values()];
const item = (key) => facts.find((fact) => fact.key === key);
const sum = (list) => list.reduce((total, n) => total + n, 0);
// A random source that walks through the choices, so every kind and thing is tried.
const counter = () => {
  let i = 0;
  return () => ((i++ * 0.37) % 1);
};

test('stories tell the numbers of the fact but never give the answer away', () => {
  const random = counter();
  for (const fact of facts.filter(storyFits)) {
    for (let round = 0; round < 6; round++) {
      const story = makeStory(fact, random);
      const text = story.sentences.join(' ');
      const numbers = (text.match(/\d+/g) ?? []).map(Number);
      assert.ok(numbers.includes(fact.a), `${fact.key}: ${text}`);
      if (story.thing !== 'wheel') assert.ok(numbers.includes(fact.b), `${fact.key}: ${text}`);
      if (fact.answer !== fact.a && fact.answer !== fact.b) assert.ok(!numbers.includes(fact.answer), `${fact.key}: ${text}`);
      assert.match(story.sentences.at(-1), /^Hur många .*\?$/);
    }
  }
});

test('the things before and after show the fact, and fit in the scene', () => {
  const random = counter();
  const seen = new Set();
  for (const fact of facts.filter(storyFits)) {
    for (let round = 0; round < 6; round++) {
      const { kind, start, end, holder } = makeStory(fact, random);
      seen.add(kind);
      assert.ok(Math.max(sum(start), sum(end)) <= MAX_THINGS, fact.key);
      assert.ok(start.length <= MAX_GROUPS && end.length <= MAX_GROUPS, fact.key);
      if (kind === 'add') assert.deepEqual([start, end], [[fact.a, fact.b], [fact.answer]]);
      if (kind === 'sub') assert.deepEqual([start, end], [[fact.a], [fact.answer]]);
      if (kind === 'mul') assert.deepEqual([start.length, start[0], end], [fact.a, fact.b, [fact.answer]]);
      if (kind === 'share') assert.deepEqual([start, end.length, end[0]], [[fact.a], fact.b, fact.answer]);
      if (kind === 'group') assert.deepEqual([start, end.length, end[0]], [[fact.a], fact.answer, fact.b]);
      if (kind === 'share') assert.equal(holder, 'kitten');
      if (kind === 'add' || kind === 'sub') assert.equal(holder, null);
    }
  }
  assert.deepEqual([...seen].sort(), ['add', 'group', 'mul', 'share', 'sub']);
});

test('the lesson examples become stories', () => {
  const share = makeStory(item('12/3'), () => 0);
  assert.equal(share.kind, 'share');
  assert.deepEqual(share.sentences, ['12 fiskar delas lika mellan 3 kattungar.', 'Hur många fiskar får varje kattunge?']);
  const wheels = makeStory(item('16/4'), () => 0.99);
  assert.equal(wheels.kind, 'group');
  assert.equal(wheels.thing, 'wheel');
  assert.deepEqual(wheels.end, [4, 4, 4, 4]);
  const baskets = makeStory(item('3*4'), () => 0);
  assert.deepEqual(baskets.sentences, ['Det står 3 korgar med 4 fiskar i varje.', 'Hur många fiskar är det?']);
  assert.match(makeStory(item('8+4'), () => 0).sentences[0], /^Clara har 8 fiskar och får 4 till\.$/);
  assert.match(makeStory(item('1+2'), () => 0).sentences[0], /har 1 fisk och/);
});

test('facts too big to show get no story', () => {
  for (const key of ['36/4', '7*8', '10*2', '1*5', '20/1'].filter(item)) assert.equal(makeStory(item(key)), null, key);
  assert.ok(storyFits(item('20/10')), 'twenty in two bowls of ten');
  assert.ok(!facts.filter((fact) => fact.op === '/').filter(storyFits).some((fact) => fact.a > MAX_THINGS));
});

test('every level that can have stories has some', () => {
  for (const level of mathDeck.levels.filter((entry) => !entry.master)) {
    const told = level.items.filter(storyFits).length;
    assert.ok(told > 0 || level.id === 'mul-6-9' || level.id === 'div-6-9', `${level.id}: ${told}`);
  }
});

test('story lines wrap evenly at word gaps, a new line for each sentence', () => {
  const lines = wrap(['12 fiskar delas lika mellan 3 kattungar.', 'Hur många fiskar får varje kattunge?'], 24);
  assert.deepEqual(lines, ['12 fiskar delas lika', 'mellan 3 kattungar.', 'Hur många fiskar', 'får varje kattunge?']);
  assert.deepEqual(wrap(['Hur många fiskar är det?'], 26), ['Hur många fiskar är det?']);
  for (const fact of facts.filter(storyFits)) {
    for (const story of [0, 0.5, 0.99].map((r) => makeStory(fact, () => r))) {
      assert.ok(story.lines.length <= 4, story.lines.join(' / '));
      assert.ok(story.lines.every((line) => line.length <= 26), story.lines.join(' / '));
      assert.ok(story.lines.every((line) => line.includes(' ')), story.lines.join(' / '));
    }
  }
});

test('a story answer is right or wrong like any other, but its reading time is not speed', async () => {
  const { Session, statOf } = await import('../src/learner.js');
  const { logRound, byWeek } = await import('../src/stats.js');
  const profile = { stats: {}, pace: {}, stars: 0, coins: 0, letterModes: {}, lastLevels: {}, tempo: 'quick' };
  const level = mathDeck.levels.find((entry) => entry.id === 'div-3-4');
  const session = new Session(profile, mathDeck, level);
  session.current = item('12/3');
  const pace = session.pace;
  session.answer(true, 1500, 4, { story: true });
  assert.deepEqual(statOf(profile, '12/3'), { box: 1, seen: 1, right: 1, ms: null });
  assert.equal(session.pace, pace, 'a story does not speed up the bubbles');
  session.current = item('12/3');
  session.answer(true, 2000, 4);
  assert.equal(statOf(profile, '12/3').ms, 2000);
  assert.equal(statOf(profile, '12/3').box, 2);
  assert.ok(session.pace < pace);
  logRound(profile, session);
  assert.deepEqual(profile.log[0].answers, [['12/3', 1, 1.5, 4, 1], ['12/3', 1, 2, 4]]);
  assert.equal(byWeek(profile, 'matte', 1)[0].seconds, 2, 'only the plain answer counts for speed');
});
