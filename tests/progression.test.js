import test from 'node:test';
import assert from 'node:assert/strict';
import { lettersDeck, letterLevel, updateLetterUnlocks } from '../src/decks/letters.js';
import { mathDeck } from '../src/decks/math.js';
import { Session, levelStars } from '../src/learner.js';

const first = lettersDeck.levels[0];
const profile = () => ({ stats: {}, pace: {}, stars: 0, letterModes: {}, lastLevels: {} });

test('paired letters keep the original saved learning keys', () => {
  assert.deepEqual(first.items.map((item) => item.key), [...'osalm']);
  assert.deepEqual(first.items.map((item) => item.answer), ['Oo', 'Ss', 'Aa', 'Ll', 'Mm']);
});

test('case choices open only after every paired letter is familiar, and stay open', () => {
  const player = profile();
  player.letterModes[first.id] = 'upper';
  for (const item of first.items.slice(1)) player.stats[item.key] = { box: 4 };
  assert.equal(letterLevel(player, first).letterCase, 'both');
  player.stats[first.items[0].key] = { box: 2 };
  updateLetterUnlocks(player);
  assert.deepEqual(player.letterUnlocks, [first.id]);
  player.stats[first.items[0].key].box = 0;
  assert.equal(letterLevel(player, first).letterCase, 'upper');
  assert.equal(letterLevel(player, lettersDeck.levels[1]).letterCase, 'both');
});

test('both, uppercase and lowercase have independent learning and consistent choices', () => {
  const player = profile();
  for (const item of first.items) player.stats[item.key] = { box: 4, seen: 4, right: 4 };
  assert.equal(levelStars(player, first), 3);
  for (const mode of ['upper', 'lower']) {
    player.letterModes[first.id] = mode;
    const level = letterLevel(player, first);
    assert.equal(levelStars(player, level), 0);
    const session = new Session(player, lettersDeck, level);
    const question = session.next();
    assert.equal(new Set(question.choices).size, question.choices.length);
    for (const answer of question.choices) {
      assert.equal(answer.length, 1);
      assert.equal(answer, mode === 'upper' ? answer.toUpperCase() : answer.toLowerCase());
    }
    session.answer(true, 60000);
    assert.equal(player.stats[question.key].box, 1);
    assert.equal(player.stats[question.key.split(':')[1]].box, 4);
  }
});

test('normal untimed answers unlock forms at the threshold', () => {
  const player = profile();
  const session = new Session(player, lettersDeck, first);
  for (const item of first.items) {
    session.current = item;
    session.answer(true, 60000);
  }
  assert.deepEqual(player.letterUnlocks, []);
  for (const item of first.items) {
    session.current = item;
    session.answer(true, 60000);
  }
  assert.deepEqual(player.letterUnlocks, [first.id]);
});

test('existing profiles preserve progress and per-subject levels across switches and reload', async () => {
  const old = {
    id: 'old', name: 'Test', track: 'bokstaver', stars: 17,
    stats: { o: { box: 4, seen: 5, right: 4 }, '1+1': { box: 3, seen: 3, right: 3 } },
    pace: {}, lastLevel: 'letters-3',
  };
  let saved = JSON.stringify({ profiles: [old] });
  globalThis.localStorage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  const profiles = await import('../src/profiles.js?migration-test');
  const player = profiles.listProfiles()[0];
  const before = structuredClone(player.stats);
  profiles.selectTrack(player, 'matte');
  assert.equal(player.lastLevel, null);
  new Session(player, mathDeck, mathDeck.levels[1]);
  profiles.selectTrack(player, 'bokstaver');
  assert.equal(player.lastLevel, 'letters-3');
  profiles.selectTrack(player, 'matte');
  assert.equal(player.lastLevel, mathDeck.levels[1].id);
  assert.deepEqual(player.stats, before);
  assert.equal(player.stars, 17);
  assert.equal(player.coins, 17, 'players start with one coin per star they had');
  player.letterModes['letters-1'] = 'lower';
  player.letterUnlocks.push('letters-1');
  profiles.save();
  const reloaded = await import('../src/profiles.js?reload-test');
  assert.deepEqual(reloaded.listProfiles()[0].lastLevels, player.lastLevels);
  assert.equal(reloaded.listProfiles()[0].letterModes['letters-1'], 'lower');
  assert.deepEqual(reloaded.listProfiles()[0].letterUnlocks, ['letters-1']);
});
