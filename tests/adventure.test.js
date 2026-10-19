import test from 'node:test';
import assert from 'node:assert/strict';
import { mathDeck } from '../src/decks/math.js';
import { Session } from '../src/learner.js';
import { factTables, mistakes, logRound } from '../src/stats.js';
import { friendOf, friendsOf, rescueFriend, hasFriend } from '../src/friends.js';

const player = () => ({ stats: {}, pace: {}, stars: 0, coins: 0, letterModes: {}, lastLevels: {}, tempo: 'quick' });
const level = (id) => mathDeck.levels.find((entry) => entry.id === id);

test('division facts are the times tables backwards, with whole answers', () => {
  const items = level('div-3-4').items;
  assert.equal(items.length, 20);
  for (const item of items) {
    assert.equal(item.a, item.answer * item.b);
    assert.ok(item.answer >= 1 && item.answer <= 10);
    assert.equal(item.key, `${item.a}/${item.b}`);
  }
  assert.ok(items.some((item) => item.prompt === '12 / 3'));
});

test('division questions offer distinct, positive wrong answers', () => {
  const session = new Session(player(), mathDeck, level('div-6-9'));
  for (let i = 0; i < 60; i++) {
    session.recent = [];
    const question = session.next();
    assert.equal(new Set(question.choices).size, question.choices.length);
    assert.ok(question.choices.includes(question.answer));
    assert.ok(question.choices.every((value) => Number.isInteger(value) && value >= 1));
  }
});

test('division shows in the statistics like the times table it comes from', () => {
  const table = factTables(mathDeck).find((entry) => entry.op === '/');
  assert.deepEqual(table.rows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(table.at(4, 3).key, '12/3');
});

test('a division mistake by one is counted as off by one', () => {
  const profile = player();
  const session = new Session(profile, mathDeck, level('div-3-4'));
  session.current = level('div-3-4').items.find((item) => item.key === '12/3');
  session.answer(false, 3000, 5);
  logRound(profile, session);
  assert.equal(mistakes(profile, 'matte').kinds.offByOne, 1);
});

test('every level has its own named kitten, the same every time', () => {
  const friends = friendsOf(mathDeck);
  assert.equal(friends.length, mathDeck.levels.length);
  assert.equal(new Set(friends.map((friend) => friend.name)).size, friends.length);
  const first = mathDeck.levels[0];
  assert.deepEqual(friendOf(mathDeck, first), friendOf(mathDeck, first));
});

test('a level kitten is rescued once and stays rescued', () => {
  const profile = player();
  const first = mathDeck.levels[0];
  assert.equal(hasFriend(profile, first), false);
  assert.equal(rescueFriend(profile, first), true);
  assert.equal(rescueFriend(profile, first), false);
  assert.deepEqual(profile.friends, [first.id]);
  assert.equal(hasFriend(profile, first), true);
});
