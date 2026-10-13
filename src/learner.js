// Chooses what to ask next and how fast the balloons come down, per player.
const MAX_BOX = 4;
const FAST_MS = 4000; // answered within this time counts as "knows it", not "counted it"
const BOX_WEIGHT = [8, 5, 3, 1.5, 0.6]; // weaker facts are asked more often

const START_PACE = 10; // seconds for a balloon to come down
const MIN_PACE = 3.5;
const MAX_PACE = 14;
// One step faster per right answer, four steps slower per miss: settles near 80 % right.
const FASTER = 0.96;
const SLOWER = 1 / FASTER ** 4;

export const ROUND_LENGTH = 10;

const statOf = (profile, key) => profile.stats[key] ?? { box: 0, seen: 0, right: 0, ms: null };

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
    this.choiceCount = mastery(profile, level) > 0.5 ? 4 : 3;
    profile.lastLevel = level.id;
  }

  get pace() {
    return this.profile.pace[this.level.id] ?? START_PACE;
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
    const weights = pool.map((item) => BOX_WEIGHT[statOf(this.profile, item.key).box]);
    let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  answer(correct, ms) {
    const item = this.current;
    const stat = statOf(this.profile, item.key);
    stat.seen += 1;
    if (correct) {
      stat.right += 1;
      stat.ms = stat.ms == null ? ms : Math.round(stat.ms * 0.6 + ms * 0.4);
      const fast = ms <= (this.deck.fastMs ?? FAST_MS);
      stat.box = fast ? Math.min(MAX_BOX, stat.box + 1) : Math.max(stat.box, 1);
      this.correct += 1;
      this.profile.stars += 1;
    } else {
      stat.box = Math.max(0, stat.box - 1);
      // A missed fact comes back two questions later, while the answer is still fresh.
      this.retries.push({ item, due: this.index + 3 });
    }
    this.profile.stats[item.key] = stat;
    const pace = this.pace * (correct ? FASTER : SLOWER);
    this.profile.pace[this.level.id] = Math.min(MAX_PACE, Math.max(MIN_PACE, pace));
    this.results.push(correct);
    this.index += 1;
  }
}
