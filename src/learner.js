// Chooses what to ask next and how fast the balloons come down, per player.
import { updateLetterUnlocks } from './decks/letters.js';
const MAX_BOX = 4;
export const FAST_MS = 4000; // answered within this time counts as "knows it", not "counted it"
const BOX_WEIGHT = [8, 5, 3, 1.5, 0.6]; // weaker facts are asked more often
// A master round is for remembering: facts never practised in their own level come up rarely.
const UNSEEN_IN_MASTER = 0.4;

const MAX_PACE = 14;
// How the balloons come down, chosen per player on the grown-ups' page.
//   start: seconds a balloon takes to come down for a player new to the subject
//   min: the fastest it gets
//   step: how much faster each right answer makes it. A miss makes it four steps slower,
//     so it settles near 80 % right.
// `calm` has no time limit: the balloons wait, as in Bokstäver.
export const TEMPOS = {
  calm: null,
  gentle: { start: 10, min: 3.5, step: 0.96 },
  quick: { start: 8, min: 2.6, step: 0.9 }, // about one round of right answers from slow to fast
};
export const DEFAULT_TEMPO = 'gentle';
// Paces (seconds per question) worth cheering when a player gets below one of them.
export const SPEEDS = [7, 5.5, 4.3, 3.4, 2.8];
// A level played for the first time starts a little slower than the player's usual pace.
const NEW_LEVEL_SLACK = 1.2;

export const ROUND_LENGTH = 10;

export const statOf = (profile, key) => profile.stats[key] ?? { box: 0, seen: 0, right: 0, ms: null };

export function mastery(profile, level) {
  const sum = level.items.reduce((total, item) => total + statOf(profile, item.key).box, 0);
  return sum / (MAX_BOX * level.items.length);
}

// Zero to three stars for a level, as shown in the menu.
export function levelStars(profile, level) {
  const share = mastery(profile, level);
  return share >= 0.85 ? 3 : share >= 0.5 ? 2 : share >= 0.2 ? 1 : 0;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export class Session {
  constructor(profile, deck, level) {
    this.profile = profile;
    this.deck = deck;
    this.level = level;
    this.length = deck.roundLength ?? ROUND_LENGTH;
    this.index = 0;
    this.correct = 0;
    this.results = [];
    this.retries = [];
    this.recent = [];
    this.current = null;
    this.started = Date.now();
    this.answers = []; // { key, correct, ms, picked } for the round log, see src/stats.js
    this.tempo = TEMPOS[profile.tempo in TEMPOS ? profile.tempo : DEFAULT_TEMPO];
    // More balloons to choose from as a level is learned.
    const known = mastery(profile, level);
    this.choiceCount = known > 0.8 ? 5 : known > 0.5 ? 4 : 3;
    profile.lastLevel = level.id;
    profile.lastLevels ??= {};
    profile.lastLevels[deck.id] = level.id;
  }

  // Whether the balloons fall and must be caught in time.
  get timed() {
    return this.deck.timed !== false && this.tempo != null;
  }

  get pace() {
    const tempo = this.tempo ?? TEMPOS[DEFAULT_TEMPO];
    const pace = this.profile.pace[this.level.id] ?? this.startPace();
    return Math.min(MAX_PACE, Math.max(tempo.min, pace));
  }

  // For a new level: the middle of the player's paces on the other levels of this subject.
  startPace() {
    const paces = this.deck.levels
      .map((level) => this.profile.pace[level.id])
      .filter((pace) => pace != null)
      .sort((a, b) => a - b);
    if (paces.length === 0) return (this.tempo ?? TEMPOS[DEFAULT_TEMPO]).start;
    return paces[Math.floor(paces.length / 2)] * NEW_LEVEL_SLACK;
  }

  get done() {
    return this.index >= this.length;
  }

  next() {
    const due = this.retries.findIndex((retry) => retry.due <= this.index);
    const item = due >= 0 ? this.retries.splice(due, 1)[0].item : this.pick();
    this.current = item;
    this.recent = [item.key, ...this.recent].slice(0, 2);
    const choices = shuffle([item.answer, ...this.deck.distractors(item, this.choiceCount - 1, this.level)]);
    return { ...item, choices };
  }

  pick() {
    const fresh = this.level.items.filter((item) => !this.recent.includes(item.key));
    const pool = fresh.length ? fresh : this.level.items;
    const weights = pool.map((item) => {
      const stat = statOf(this.profile, item.key);
      return this.level.master && stat.seen === 0 ? UNSEEN_IN_MASTER : BOX_WEIGHT[stat.box];
    });
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  // `picked` is the answer chosen, or null when time ran out. A `story` question (a word
  // problem, see src/game/stories.js) takes time to read, so it says nothing about speed:
  // it neither counts as fast nor changes the pace.
  answer(correct, ms, picked = null, { story = false } = {}) {
    const item = this.current;
    const stat = statOf(this.profile, item.key);
    stat.seen += 1;
    this.answers.push({ key: item.key, correct, ms, picked, ...(story && { story }) });
    this.lastAnswerAt = Date.now();
    if (correct) {
      stat.right += 1;
      if (!story) stat.ms = stat.ms == null ? ms : Math.round(stat.ms * 0.6 + ms * 0.4);
      const fast = !story && ms <= (this.deck.fastMs ?? FAST_MS);
      stat.box = fast ? Math.min(MAX_BOX, stat.box + 1) : Math.max(stat.box, 1);
      this.correct += 1;
      this.profile.stars += 1;
    } else {
      stat.box = Math.max(0, stat.box - 1);
      // A missed fact comes back two questions later, while the answer is still fresh.
      this.retries.push({ item, due: this.index + 3 });
    }
    this.profile.stats[item.key] = stat;
    if (this.deck.id === 'bokstaver') updateLetterUnlocks(this.profile);
    if (this.timed && !story) {
      const { step, min } = this.tempo;
      const pace = this.pace * (correct ? step : 1 / step ** 4);
      this.profile.pace[this.level.id] = Math.min(MAX_PACE, Math.max(min, pace));
    }
    this.results.push(correct);
    this.index += 1;
  }
}
