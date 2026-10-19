import { statOf, FAST_MS } from './learner.js';

// What the grown-ups' statistics page shows, worked out from what is saved on this device:
// each fact's learning state (profile.stats) and a log of played rounds (profile.log).
const KEEP_ROUNDS = 400;
const DAY = 24 * 3600 * 1000;

// Adds a played round to the player's log, once, even if it was stopped halfway.
// Each answer is kept short: [key, 1 if right, seconds, the answer picked or null], and a
// fifth 1 if it was asked as a story (a word problem: its time is reading time, not speed).
export function logRound(profile, session) {
  if (session.logged || session.answers.length === 0) return;
  session.logged = true;
  profile.log ??= [];
  profile.log.push({
    at: session.started,
    deck: session.deck.id,
    level: session.level.id,
    seconds: Math.round(((session.lastAnswerAt ?? Date.now()) - session.started) / 1000),
    answers: session.answers.map(({ key, correct, ms, picked, story }) => {
      const answer = [key, correct ? 1 : 0, Math.round(ms / 100) / 10, picked];
      return story ? [...answer, 1] : answer;
    }),
  });
  if (profile.log.length > KEEP_ROUNDS) profile.log.splice(0, profile.log.length - KEEP_ROUNDS);
}

const roundsOf = (profile, deckId) => (profile.log ?? []).filter((round) => !deckId || round.deck === deckId);

// The last seven days: rounds, days played, minutes and answers right.
export function lastWeek(profile, deckId, now = Date.now()) {
  const rounds = roundsOf(profile, deckId).filter((round) => round.at >= now - 7 * DAY);
  const answers = rounds.flatMap((round) => round.answers);
  return {
    rounds: rounds.length,
    days: new Set(rounds.map((round) => new Date(round.at).toDateString())).size,
    minutes: Math.round(rounds.reduce((sum, round) => sum + round.seconds, 0) / 60),
    right: answers.filter((answer) => answer[1]).length,
    total: answers.length,
  };
}

// Every fact of a deck once, in level order.
export function factsOf(deck) {
  const facts = new Map();
  for (const level of deck.levels) for (const item of level.items) if (!facts.has(item.key)) facts.set(item.key, item);
  return [...facts.values()];
}

// How well a fact sits: 'known' (by heart), 'slow' (right, but slowly: probably counted),
// 'shaky' (often wrong) or 'unseen'.
export function factClass(profile, deck, key) {
  const stat = statOf(profile, key);
  if (!stat.seen) return 'unseen';
  if (stat.box === 0 || stat.right / stat.seen < 0.6) return 'shaky';
  if (stat.box >= 3 && (stat.ms ?? Infinity) <= (deck.fastMs ?? FAST_MS)) return 'known';
  return 'slow';
}

// The facts to practise next: often wrong, slow, or not yet settled, most needed first.
export function practiseNext(profile, deck, count = 6) {
  const fast = Number.isFinite(deck.fastMs ?? FAST_MS) ? (deck.fastMs ?? FAST_MS) : null;
  return factsOf(deck)
    .map((item) => ({ item, stat: statOf(profile, item.key), kind: factClass(profile, deck, item.key) }))
    .filter(({ stat, kind }) => stat.seen > 0 && kind !== 'known')
    .map((fact) => {
      const { stat } = fact;
      const slowness = fast && stat.ms ? Math.min(stat.ms / fast, 3) : 0;
      return { ...fact, need: (1 - stat.right / stat.seen) * 3 + (4 - stat.box) * 0.5 + slowness * 0.5 };
    })
    .sort((a, b) => b.need - a.need)
    .slice(0, count);
}

// Math facts in tables, one per operation: rows by the first number, columns by the second.
export function factTables(deck) {
  const tables = new Map();
  for (const item of factsOf(deck)) {
    if (item.op == null) continue;
    if (!tables.has(item.op)) tables.set(item.op, new Map());
    tables.get(item.op).set(item.key, item);
  }
  return [...tables].map(([op, items]) => {
    const values = [...items.values()];
    // Division rows go by the answer, so the table looks like the times table it comes from.
    const rowOf = (item) => (op === '/' ? item.answer : item.a);
    const rows = [...new Set(values.map(rowOf))].sort((a, b) => a - b);
    const columns = [...new Set(values.map((item) => item.b))].sort((a, b) => a - b);
    const at = op === '/' ? (row, b) => items.get(`${row * b}/${b}`) : (a, b) => items.get(`${a}${op}${b}`);
    return { op, rows, columns, at };
  });
}

// Monday of the week a time falls in, and that week's number.
function weekOf(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const number = 1 + Math.round((thursday - firstThursday) / (7 * DAY) - ((firstThursday.getDay() + 6) % 7 - 3) / 7);
  return { start: date.getTime(), number };
}

// The last few weeks, oldest first: seconds per right answer and share right (null if not played).
export function byWeek(profile, deckId, weeks = 6, now = Date.now()) {
  const thisWeek = weekOf(now).start;
  return Array.from({ length: weeks }, (_, i) => {
    const start = thisWeek - (weeks - 1 - i) * 7 * DAY;
    const answers = roundsOf(profile, deckId)
      .filter((round) => round.at >= start && round.at < start + 7 * DAY)
      .flatMap((round) => round.answers);
    const right = answers.filter((answer) => answer[1]);
    const timed = right.filter((answer) => !answer[4]);
    return {
      week: weekOf(start).number,
      seconds: timed.length ? timed.reduce((sum, answer) => sum + answer[2], 0) / timed.length : null,
      share: answers.length ? right.length / answers.length : null,
    };
  });
}

// What kinds of mistakes are made. For math: off by one or two (often miscounting on
// fingers), off by ten, mixing up plus and times, or running out of time. For letters:
// which letters get confused with which, most often first.
export function mistakes(profile, deckId) {
  const wrong = roundsOf(profile, deckId)
    .flatMap((round) => round.answers)
    .filter((answer) => !answer[1]);
  const kinds = { timeouts: 0, offByOne: 0, offByTwo: 0, offByTen: 0, mixedOps: 0, other: 0 };
  const pairs = new Map();
  for (const [key, , , picked] of wrong) {
    if (picked == null) {
      kinds.timeouts += 1;
      continue;
    }
    const math = /^(\d+)([+\-*/])(\d+)$/.exec(key);
    if (math) {
      const [a, op, b] = [Number(math[1]), math[2], Number(math[3])];
      const answer = op === '+' ? a + b : op === '-' ? a - b : op === '/' ? a / b : a * b;
      const off = Math.abs(picked - answer);
      if ((op === '+' && picked === a * b) || (op === '*' && picked === a + b)) kinds.mixedOps += 1;
      else if (off === 1) kinds.offByOne += 1;
      else if (off === 2) kinds.offByTwo += 1;
      else if (off === 10) kinds.offByTen += 1;
      else kinds.other += 1;
    } else {
      const pair = [key.split(':').pop(), String(picked).slice(-1).toLowerCase()].sort().join(' – ');
      pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
    }
  }
  const confusions = [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { total: wrong.length, kinds, confusions };
}
