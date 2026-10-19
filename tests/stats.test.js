import test from 'node:test';
import assert from 'node:assert/strict';
import { mathDeck } from '../src/decks/math.js';
import { lettersDeck } from '../src/decks/letters.js';
import { Session } from '../src/learner.js';
import { logRound, lastWeek, mistakes, practiseNext, factClass, byWeek } from '../src/stats.js';

const player = () => ({ stats: {}, pace: {}, stars: 0, coins: 0, letterModes: {}, lastLevels: {}, tempo: 'quick' });

test('master rounds mix every fact of the levels before them, once each', () => {
  const index = mathDeck.levels.findIndex((level) => level.master);
  assert.equal(index, 3);
  const master = mathDeck.levels[index];
  const before = new Set(mathDeck.levels.slice(0, index).flatMap((level) => level.items.map((item) => item.key)));
  assert.deepEqual(new Set(master.items.map((item) => item.key)), before);
  assert.equal(master.items.length, before.size);
  assert.ok(mathDeck.levels.at(-1).master, 'math ends with a master round');
  assert.ok(!lettersDeck.levels.at(-1).master, 'letters end with all letters instead');
});

test('a master round rarely asks facts never practised in their own level', () => {
  const profile = player();
  const master = mathDeck.levels.find((level) => level.master);
  const practised = master.items.slice(0, 5);
  for (const item of practised) profile.stats[item.key] = { box: 1, seen: 2, right: 1, ms: 5000 };
  const session = new Session(profile, mathDeck, master);
  let known = 0;
  for (let i = 0; i < 400; i++) {
    session.recent = [];
    if (practised.includes(session.pick())) known += 1;
  }
  assert.ok(known > 200, `${known} of 400 picks were practised facts`);
});

test('rounds are logged once, with the picked answer, even when stopped halfway', () => {
  const profile = player();
  const level = mathDeck.levels[0];
  const session = new Session(profile, mathDeck, level);
  session.current = level.items.find((item) => item.key === '2+1');
  session.answer(false, 3000, 4);
  session.current = level.items.find((item) => item.key === '1+1');
  session.answer(true, 1500, 2);
  logRound(profile, session);
  logRound(profile, session);
  assert.equal(profile.log.length, 1);
  assert.deepEqual(profile.log[0].answers, [['2+1', 0, 3, 4], ['1+1', 1, 1.5, 2]]);
  const week = lastWeek(profile, 'matte');
  assert.deepEqual([week.rounds, week.days, week.right, week.total], [1, 1, 1, 2]);
  assert.equal(byWeek(profile, 'matte').at(-1).seconds, 1.5);
});

test('mistakes are sorted into counting slips, mixed-up operations and timeouts', () => {
  const profile = player();
  profile.log = [
    {
      at: Date.now(),
      deck: 'matte',
      level: 'x',
      seconds: 30,
      answers: [
        ['7+8', 0, 5, 14],
        ['3+4', 0, 5, 12],
        ['3*4', 0, 5, 7],
        ['6+6', 0, 9, null],
        ['5+5', 1, 2, 10],
      ],
    },
    { at: Date.now(), deck: 'bokstaver', level: 'y', seconds: 20, answers: [['b', 0, 4, 'Dd'], ['upper:d', 0, 4, 'B']] },
  ];
  const math = mistakes(profile, 'matte');
  assert.equal(math.total, 4);
  assert.deepEqual(math.kinds, { timeouts: 1, offByOne: 1, offByTwo: 0, offByTen: 0, mixedOps: 2, other: 0 });
  assert.deepEqual(mistakes(profile, 'bokstaver').confusions, [['b – d', 2]]);
});

test('facts known by heart are told apart from counted ones, and the weakest come first', () => {
  const profile = player();
  profile.stats['1+1'] = { box: 4, seen: 5, right: 5, ms: 1500 };
  profile.stats['2+1'] = { box: 2, seen: 5, right: 5, ms: 7000 };
  profile.stats['3+1'] = { box: 0, seen: 4, right: 1, ms: 6000 };
  assert.equal(factClass(profile, mathDeck, '1+1'), 'known');
  assert.equal(factClass(profile, mathDeck, '2+1'), 'slow');
  assert.equal(factClass(profile, mathDeck, '3+1'), 'shaky');
  assert.equal(factClass(profile, mathDeck, '4+1'), 'unseen');
  assert.deepEqual(practiseNext(profile, mathDeck).map(({ item }) => item.key), ['3+1', '2+1']);
});
