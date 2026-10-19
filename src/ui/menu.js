import { sv } from '../i18n/sv.js';
import { DECKS, UPCOMING_DECKS } from '../decks/index.js';
import { listProfiles, createProfile, deleteProfile, selectTrack, save } from '../profiles.js';
import { letterLevel } from '../decks/letters.js';
import { levelStars, statOf, DEFAULT_TEMPO } from '../learner.js';
import { lastWeek, practiseNext, factsOf, factClass, factTables, byWeek, mistakes } from '../stats.js';
import { DEFAULT_LOOK, newLook, paletteOf } from '../wardrobe/look.js';
import { picture } from '../wardrobe/creatures/index.js';
import { say, unlockAudio } from '../audio.js';
import { friendsOf, friendOf, hasFriend } from '../friends.js';
import { kittenPicture } from '../game/kittens.js';

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (value === true) el.setAttribute(key, '');
    else if (value !== false && value != null) el.setAttribute(key, value);
  }
  el.append(...children.flat(Infinity).filter((child) => child != null && child !== false));
  return el;
}

const pictures = new Map();
function avatar(look, expression = 'open') {
  const key = `${look.creature}/${JSON.stringify(look.paint)}/${expression}`;
  if (!pictures.has(key)) pictures.set(key, picture(look, expression));
  return h('img', { class: 'avatar', src: pictures.get(key), alt: '' });
}

// Each player's balloon, subject tile and level stop gets one of these candy colours.
const CANDY = ['pink', 'purple', 'blue', 'orange', 'mint'];
const DECK_ART = { matte: ['1+2', 'pink'], bokstaver: ['Aa', 'blue'] };
const LEVEL_COLORS = { pink: 'pink', blue: 'blue', orange: 'orange', green: 'mint', purple: 'purple', gold: 'gold' };
const STOP_GAP = 118; // pixels between two stops on the level path

// Three stars, filled as the facts in a level are learned.
const stars = (count) => h('span', { class: 'stars' }, '★'.repeat(count), h('span', { class: 'off' }, '★'.repeat(3 - count)));

// A word drawn like a sticker: white letters with a thick dark outline.
const sticker = (tag, text, extra = '') => h(tag, { class: `sticker ${extra}` }, text);

// The game's name, every letter in its own colour, bouncing one after another.
const logo = () =>
  h('h1', { class: 'logo', 'aria-label': sv.title }, [...sv.title].map((char, i) => h('span', { style: `--i: ${i}` }, char)));

const roundButton = (label, title, onclick, extra = '') => h('button', { class: `round ${extra}`, title, 'aria-label': title, onclick }, label);

// A count with its icon, like a game's coin counter.
export function counter(icon, value, kind) {
  return h('span', { class: `counter ${kind}` }, h('span', { class: 'icon' }, icon), h('b', {}, String(value)));
}

// The 2D pages shown before the game: pick a player, then the usual game's path of levels with
// one big Spela button. The other games and the room are one tap away above it.
// `onPreview(look, move)` shows that pet next to the menu; `onRoom(profile)` opens the pet's room.
export class Menu {
  constructor(root, { onStart, onRoom, onPreview }) {
    this.root = root;
    this.onStart = onStart;
    this.onRoom = onRoom;
    this.onPreview = onPreview;
    this.xrSupported = false;
    this.xrAvailable = false;
    this.screen = 'profiles';
    this.profile = null;
    this.level = null;
    this.error = null;
    this.go('profiles');
  }

  setXRSupported(supported) {
    this.xrSupported = supported;
    if (this.screen === 'home') this.render();
  }

  setXRAvailable(available) {
    this.xrAvailable = available;
    if (this.screen === 'home') this.render();
  }

  show() {
    this.root.hidden = false;
    // After a round the suggested level may have moved on.
    if (this.profile) this.level = this.nextLevel(DECKS[this.profile.track]);
    this.go(this.profile ? 'home' : 'profiles');
  }

  hide() {
    this.root.hidden = true;
  }

  showError(text) {
    this.error = text;
    this.render();
  }

  go(screen, move) {
    this.screen = listProfiles().length === 0 && screen === 'profiles' ? 'create' : screen;
    this.error = null;
    this.render(false);
    this.onPreview(this.profile && this.screen !== 'profiles' && this.screen !== 'create' ? this.profile.look : DEFAULT_LOOK, move);
  }

  choose(profile, screen = 'home') {
    const deck = DECKS[profile.track];
    this.profile = profile;
    this.level = this.nextLevel(deck);
    this.go(screen, 'wave');
  }

  practiceLevel(level = this.level, deckId = this.profile.track) {
    return deckId === 'bokstaver' ? letterLevel(this.profile, level) : level;
  }

  render(keepScroll = true) {
    const trail = this.root.querySelector('.trail');
    const scrollTop = keepScroll && trail ? trail.scrollTop : null;
    const withPlayer = !['profiles', 'create'].includes(this.screen) && this.profile;
    const stage = h('div', { class: `stage ${this.screen}` }, this[this.screen]());
    this.root.replaceChildren(...[withPlayer && this.hud(), stage].filter(Boolean));
    const newTrail = this.root.querySelector('.trail');
    if (!newTrail) return;
    if (scrollTop != null) newTrail.scrollTop = scrollTop;
    else this.root.querySelector('.stop.selected')?.scrollIntoView({ block: 'center' });
  }

  // The bar at the top: who is playing (tap to switch), and their stars and coins.
  hud() {
    const { profile } = this;
    return h(
      'div',
      { class: 'hud' },
      h('button', { class: 'me', title: sv.switchPlayer, onclick: () => this.go('profiles') }, avatar(profile.look, 'happy'), h('span', {}, profile.name)),
      h('div', { class: 'counters' }, counter('⭐', profile.stars, 'star'), counter('🪙', profile.coins, 'coin')),
    );
  }

  profiles() {
    return [
      logo(),
      sticker('h2', sv.whoPlays),
      h(
        'div',
        { class: 'balloons' },
        listProfiles().map((profile, i) =>
          h(
            'button',
            {
              class: `balloon c-${CANDY[i % CANDY.length]}`,
              style: `--delay: ${-i * 0.7}s`,
              onclick: () => this.choose(profile),
              onpointerenter: () => this.onPreview(profile.look),
            },
            h('span', { class: 'skin' }, avatar(profile.look, 'happy')),
            h('span', { class: 'string' }),
            h('span', { class: 'name' }, profile.name),
          ),
        ),
        h(
          'button',
          { class: 'balloon new', style: '--delay: -1.3s', onclick: () => this.go('create') },
          h('span', { class: 'skin' }, '+'),
          h('span', { class: 'string' }),
          h('span', { class: 'name' }, sv.newPlayer),
        ),
      ),
    ];
  }

  create() {
    const look = newLook();
    let track = Object.keys(DECKS)[0];
    const tracks = Object.values(DECKS).map((deck) => {
      const [art, color] = DECK_ART[deck.id] ?? [deck.name[0], 'purple'];
      return h(
        'button',
        {
          type: 'button',
          class: `pick c-${color}${deck.id === track ? ' selected' : ''}`,
          onclick: (event) => {
            track = deck.id;
            tracks.forEach((button) => button.classList.toggle('selected', button === event.currentTarget));
          },
        },
        h('span', { class: 'art' }, art),
        deck.name,
      );
    });
    const input = h('input', { class: 'nametag', type: 'text', maxlength: 14, autocomplete: 'off', placeholder: sv.namePlaceholder });
    const faces = Object.keys(paletteOf(look)).map((id) =>
      h(
        'button',
        {
          type: 'button',
          class: id === look.paint.fur ? 'face selected' : 'face',
          title: sv.colors[id],
          onclick: (event) => {
            look.paint.fur = id;
            faces.forEach((face) => face.classList.toggle('selected', face === event.currentTarget));
            this.onPreview(look, 'hop');
          },
        },
        avatar({ ...look, paint: { fur: id } }),
      ),
    );
    const submit = (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (name) this.choose(createProfile(name, track, look));
      else input.focus();
    };
    return h(
      'form',
      { class: 'form', onsubmit: submit },
      listProfiles().length > 0 && roundButton('✕', sv.cancel, () => this.go('profiles'), 'close'),
      sticker('h2', sv.yourName),
      input,
      sticker('h3', sv.pickCat, 'small'),
      h('div', { class: 'faces' }, faces),
      sticker('h3', sv.whatGame, 'small'),
      h(
        'div',
        { class: 'picks' },
        tracks,
        UPCOMING_DECKS.map((name) => h('span', { class: 'pick locked' }, h('span', { class: 'art' }, '🔒'), name)),
      ),
      h('button', { class: 'btn go', type: 'submit' }, sv.save),
    );
  }

  // The level to play now in a deck: the last one chosen, or the next one to learn
  // when that one already has three stars.
  nextLevel(deck) {
    const { profile } = this;
    const last = deck.levels.find((level) => level.id === profile.lastLevels[deck.id]) ?? deck.levels[0];
    const done = (level) => levelStars(profile, this.practiceLevel(level, deck.id)) === 3;
    if (!done(last)) return last;
    return deck.levels.slice(deck.levels.indexOf(last) + 1).find((level) => !done(level)) ?? last;
  }

  // Plays a deck at once, at the level chosen for it. It becomes the player's usual game.
  playDeck(deck, level = this.nextLevel(deck), useXR = this.xrSupported) {
    const { profile } = this;
    if (profile.track !== deck.id) selectTrack(profile, deck.id);
    this.level = level;
    profile.lastLevel = this.level.id;
    profile.lastLevels[deck.id] = this.level.id;
    save();
    this.onStart(profile, this.practiceLevel(), useXR);
  }

  // A small button for when the headset said no to VR but may still manage it.
  vrFallback(onclick) {
    return this.xrAvailable && !this.xrSupported && h('button', { class: 'btn alt', onclick }, `🥽 ${sv.inVR}`);
  }

  // Home: the usual game's path of levels, with the pet on the level to play and one big
  // Spela button. The other games and the room are small tiles above it.
  home() {
    const { profile } = this;
    const deck = DECKS[profile.track];
    if (!deck.levels.includes(this.level)) this.level = this.nextLevel(deck);
    const switcher = h(
      'div',
      { class: 'switcher' },
      Object.values(DECKS)
        .filter((other) => other !== deck)
        .map((other) => {
          const [art, color] = DECK_ART[other.id] ?? [other.name[0], 'purple'];
          return h(
            'button',
            {
              class: `mini c-${color}`,
              onclick: () => {
                selectTrack(profile, other.id);
                this.level = this.nextLevel(other);
                this.render(false);
                this.onPreview(profile.look, 'hop');
              },
            },
            h('span', { class: 'art' }, art),
            h('span', { class: 'label' }, other.name),
          );
        }),
      deck.adventure && this.kittenTile(deck),
      h(
        'button',
        { class: 'mini c-orange', onclick: () => this.onRoom(profile) },
        h('span', { class: 'art emoji' }, '🏠'),
        h('span', { class: 'label' }, sv.room),
        profile.fresh.length > 0 && h('span', { class: 'tag' }, sv.newTag),
      ),
      UPCOMING_DECKS.map((name) => h('span', { class: 'mini locked' }, h('span', { class: 'art emoji' }, '🔒'), h('span', { class: 'label' }, name))),
    );
    return [
      switcher,
      h(
        'div',
        { class: 'bar' },
        this.parentButton(),
        sticker('h2', deck.name),
        deck.soundboard ? roundButton('🔊', sv.listen, () => this.go('listen'), 'sound') : h('span', { class: 'round spacer' }),
      ),
      this.roadmap(deck),
      deck.id === 'bokstaver' && this.letterOptions(),
      this.error && h('p', { class: 'error' }, this.error),
      h(
        'div',
        { class: 'plays' },
        h('button', { class: 'btn go play', onclick: () => this.playDeck(deck, this.level) }, `▶ ${sv.play}`),
        this.vrFallback(() => this.playDeck(deck, this.level, true)),
      ),
    ];
  }

  // The levels as stops along a winding path; tapping one chooses it. Master rounds are gold.
  roadmap(deck) {
    const { profile } = this;
    const xOf = (i) => 50 + Math.sin(i * 1.15) * 27;
    const yOf = (i) => 120 + i * STOP_GAP;
    const height = yOf(deck.levels.length - 1) + 120;
    let road = `M ${xOf(0)} ${yOf(0)}`;
    for (let i = 1; i < deck.levels.length; i++) {
      const middle = (yOf(i - 1) + yOf(i)) / 2;
      road += ` C ${xOf(i - 1)} ${middle}, ${xOf(i)} ${middle}, ${xOf(i)} ${yOf(i)}`;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 100 ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = `<path class="road" d="${road}"/><path class="dashes" d="${road}"/>`;
    const stops = deck.levels.map((level, i) => {
      const selected = level === this.level;
      return h(
        'button',
        {
          class: `stop c-${LEVEL_COLORS[level.color] ?? 'purple'}${level.master ? ' master' : ''}${selected ? ' selected' : ''}`,
          style: `left: ${xOf(i)}%; top: ${yOf(i)}px`,
          onclick: () => {
            this.level = level;
            profile.lastLevel = level.id;
            profile.lastLevels[deck.id] = level.id;
            save();
            this.render();
            this.onPreview(profile.look, 'hop');
          },
        },
        selected && h('span', { class: 'pin' }, avatar(profile.look, 'happy')),
        deck.adventure && hasFriend(profile, level) && h('img', { class: 'friend', src: kittenPicture(friendOf(deck, level).look), alt: '' }),
        h('span', { class: 'disc' }, level.badge),
        stars(levelStars(profile, this.practiceLevel(level, deck.id))),
        h('span', { class: 'name' }, level.name),
      );
    });
    return h('div', { class: 'trail' }, h('div', { class: 'path', style: `height: ${height}px` }, svg, stops));
  }

  // A gear that opens the grown-ups' page only when held down, so it is not opened by mistake.
  parentButton() {
    let timer = null;
    const cancel = () => clearTimeout(timer);
    return h(
      'button',
      {
        class: 'round parent',
        title: sv.parentHold,
        'aria-label': sv.parents,
        onpointerdown: () => {
          timer = setTimeout(() => this.go('parent'), 1200);
        },
        onpointerup: cancel,
        onpointerleave: cancel,
        oncontextmenu: (event) => event.preventDefault(),
      },
      '⚙️',
    );
  }

  // For grown-ups: things a child should not do by accident.
  parent() {
    const { profile } = this;
    const remove = () => {
      if (!confirm(sv.confirmDelete(profile.name))) return;
      deleteProfile(profile.id);
      this.profile = null;
      this.go('profiles');
    };
    return [
      h('div', { class: 'bar' }, roundButton('←', sv.back, () => this.go('home')), sticker('h2', sv.parents), h('span', { class: 'round spacer' })),
      sticker('h3', `${sv.tempo}: ${profile.name}`, 'small'),
      h(
        'div',
        { class: 'tempos' },
        Object.entries(sv.tempos).map(([id, [label, hint]]) =>
          h(
            'button',
            {
              class: `tempo${(profile.tempo ?? DEFAULT_TEMPO) === id ? ' selected' : ''}`,
              onclick: () => {
                profile.tempo = id;
                save();
                this.render();
              },
            },
            h('b', {}, label),
            h('span', {}, hint),
          ),
        ),
      ),
      h(
        'button',
        {
          class: 'btn ghost',
          onclick: () => {
            profile.music = profile.music === false;
            save();
            this.render();
          },
        },
        profile.music === false ? sv.musicOff : sv.musicOn,
      ),
      h('button', { class: 'btn go', onclick: () => this.go('stats') }, `📊 ${sv.stats.title}`),
      h('button', { class: 'btn alt', onclick: () => this.playDeck(DECKS[profile.track], undefined, false) }, `🖥️ ${sv.playOnScreen}`),
      h('button', { class: 'btn ghost', onclick: remove }, `🗑️ ${sv.deletePlayer}`),
    ];
  }

  // Uppercase and lowercase on their own open once every letter of the group is known.
  letterOptions() {
    const { profile, level } = this;
    const practice = this.practiceLevel();
    const unlocked = profile.letterUnlocks.includes(level.id);
    const known = level.items.filter((item) => (profile.stats[item.key]?.box ?? 0) >= 2).length;
    return h(
      'div',
      { class: 'toggles', title: unlocked ? sv.letterFormReady : sv.letterFormLocked(known, level.items.length) },
      Object.entries(sv.letterForms).map(([mode, label]) =>
        h(
          'button',
          {
            class: `toggle${practice.letterCase === mode ? ' selected' : ''}`,
            disabled: mode !== 'both' && !unlocked,
            'aria-pressed': String(practice.letterCase === mode),
            onclick: () => {
              profile.letterModes[level.id] = mode;
              save();
              this.render();
            },
          },
          label,
        ),
      ),
      !unlocked && h('span', { class: 'lock' }, `🔒 ${known}/${level.items.length}`),
    );
  }

  // For grown-ups: how the practising goes, from what is saved on this device.
  stats() {
    const { profile } = this;
    const deck = DECKS[this.statsDeck ?? profile.track];
    const week = lastWeek(profile, deck.id);
    const next = practiseNext(profile, deck);
    const weeks = byWeek(profile, deck.id);
    const wrong = mistakes(profile, deck.id);
    const factName = (item) => (item.prompt ? `${item.prompt} = ${item.answer}` : item.answer);
    const seconds = (value) => `${value.toFixed(1).replace('.', ',')} s`;
    const card = (title, ...body) => h('section', { class: 'card' }, h('h3', {}, title), body);
    const number = (value, label) => h('div', { class: 'number' }, h('b', {}, String(value)), h('span', {}, label));

    const timed = deck.timed !== false;
    const kindNames = timed ? sv.stats.kinds : sv.stats.letterKinds;
    const legend = h(
      'div',
      { class: 'legend' },
      Object.entries(kindNames).map(([kind, label]) => h('span', {}, h('i', { class: `fact ${kind}` }), label)),
    );
    const cell = (item) => {
      if (!item) return h('td', {});
      const stat = statOf(profile, item.key);
      const detail = stat.seen ? sv.stats.detail(stat.right, stat.seen, stat.ms ? seconds(stat.ms / 1000) : null) : kindNames.unseen;
      return h('td', { class: `fact ${factClass(profile, deck, item.key)}`, title: `${factName(item)}: ${detail}` });
    };
    const facts =
      deck.id === 'matte'
        ? factTables(deck).map((table) =>
            h(
              'table',
              { class: 'facts' },
              h('tr', {}, h('th', {}, { '*': '·', '-': '−', '/': '/' }[table.op] ?? '+'), table.columns.map((b) => h('th', {}, String(b)))),
              table.rows.map((a) => h('tr', {}, h('th', {}, String(a)), table.columns.map((b) => cell(table.at(a, b))))),
            ),
          )
        : h(
            'div',
            { class: 'letterfacts' },
            factsOf(deck)
              .filter((item) => !item.key.includes(':'))
              .sort((a, b) => a.key.localeCompare(b.key, 'sv'))
              .map((item) => h('span', { class: `fact ${factClass(profile, deck, item.key)}`, title: factName(item) }, item.answer)),
          );

    const longest = Math.max(1, ...weeks.map((entry) => entry.seconds ?? 0));
    const speed = h(
      'div',
      { class: 'weeks' },
      weeks.map((entry) =>
        h(
          'div',
          { class: 'week' },
          h('div', { class: 'bar-box' }, entry.seconds != null && h('div', { class: 'bar-fill', style: `height: ${(100 * entry.seconds) / longest}%` })),
          h('b', {}, entry.seconds != null ? seconds(entry.seconds) : '–'),
          h('span', {}, entry.share != null ? `${Math.round(entry.share * 100)} %` : ''),
          h('small', {}, `v. ${entry.week}`),
        ),
      ),
    );

    const kinds = Object.entries(wrong.kinds).filter(([, count]) => count > 0);
    return [
      h('div', { class: 'bar' }, roundButton('←', sv.back, () => this.go('parent')), sticker('h2', `${sv.stats.title}: ${profile.name}`), h('span', { class: 'round spacer' })),
      h(
        'div',
        { class: 'toggles' },
        Object.values(DECKS).map((other) =>
          h(
            'button',
            {
              class: `toggle wide${other === deck ? ' selected' : ''}`,
              onclick: () => {
                this.statsDeck = other.id;
                this.render(false);
              },
            },
            other.name,
          ),
        ),
      ),
      h(
        'div',
        { class: 'cards' },
        card(
          sv.stats.week,
          h(
            'div',
            { class: 'numbers' },
            number(week.days, sv.stats.days),
            number(week.minutes, sv.stats.minutes),
            number(week.rounds, sv.stats.rounds),
            number(week.total ? `${Math.round((100 * week.right) / week.total)} %` : '–', sv.stats.right),
          ),
        ),
        card(
          sv.stats.next,
          next.length
            ? h(
                'ol',
                { class: 'next' },
                next.map(({ item, stat }) =>
                  h('li', {}, h('b', {}, factName(item)), h('span', {}, sv.stats.detail(stat.right, stat.seen, stat.ms && timed ? seconds(stat.ms / 1000) : null))),
                ),
              )
            : h('p', {}, sv.stats.nothingNext),
        ),
        card(sv.stats.facts, legend, facts),
        timed && card(sv.stats.speed, speed, h('p', { class: 'note' }, sv.stats.speedNote)),
        card(
          sv.stats.mistakes,
          wrong.total === 0
            ? h('p', {}, sv.stats.noMistakes)
            : [
                kinds.length > 0 && h('ul', { class: 'kinds' }, kinds.map(([kind, count]) => h('li', {}, h('b', {}, String(count)), ' ', sv.stats.mistakeKinds[kind]))),
                wrong.confusions.length > 0 &&
                  h('ul', { class: 'kinds' }, wrong.confusions.map(([pair, count]) => h('li', {}, h('b', {}, String(count)), ' ', sv.stats.confused(pair)))),
              ],
        ),
      ),
      h('p', { class: 'note' }, sv.stats.onDevice),
    ];
  }

  // The tile to the kitten collection, with how many are rescued.
  kittenTile(deck) {
    const friends = friendsOf(deck);
    const have = friends.filter((friend) => this.profile.friends.includes(friend.id)).length;
    return h(
      'button',
      { class: 'mini c-purple', onclick: () => this.go('kittens', 'hop') },
      h('span', { class: 'art' }, `${have}/${friends.length}`),
      h('span', { class: 'label' }, `🐱 ${sv.kittens.tile}`),
    );
  }

  // Every level's own kitten: rescued ones with their names, the rest as shadows to find.
  kittens() {
    const { profile } = this;
    const deck = Object.values(DECKS).find((other) => other.adventure);
    const friends = friendsOf(deck);
    const have = friends.filter((friend) => profile.friends.includes(friend.id)).length;
    return [
      h('div', { class: 'bar' }, roundButton('←', sv.back, () => this.go('home')), sticker('h2', sv.kittens.title), h('span', { class: 'round spacer' })),
      sticker('h3', sv.kittens.count(have, friends.length), 'small'),
      h(
        'div',
        { class: 'collection' },
        deck.levels.map((level, i) => {
          const friend = friends[i];
          const found = profile.friends.includes(friend.id);
          return h(
            'div',
            { class: `kitten c-${LEVEL_COLORS[level.color] ?? 'purple'}${found ? '' : ' missing'}`, style: `--tilt: ${((i % 3) - 1) * 3}deg` },
            h('img', { src: kittenPicture(friend.look, found ? 'happy' : 'open'), alt: '' }),
            h('b', {}, found ? friend.name : '?'),
            h('span', { class: 'badge' }, level.badge),
          );
        }),
      ),
      h('p', { class: 'note' }, sv.kittens.rescued(profile.kittens ?? 0)),
      have < friends.length && h('p', { class: 'note' }, sv.kittens.hint),
    ];
  }

  // Every item of a spoken game as a bubble that says it: for exploring, and for checking the clips.
  listen() {
    const deck = DECKS[this.profile.track];
    const items = new Map(deck.levels.flatMap((level) => level.items).map((item) => [item.key, item]));
    const keys = [...items.keys()].sort((a, b) => a.localeCompare(b, 'sv'));
    return [
      h('div', { class: 'bar' }, roundButton('←', sv.back, () => this.go('home')), sticker('h2', sv.listenTitle), h('span', { class: 'round spacer' })),
      h(
        'div',
        { class: 'letters' },
        keys.map((key, i) =>
          h(
            'button',
            {
              class: `letter c-${CANDY[i % CANDY.length]}`,
              onclick: () => {
                unlockAudio();
                say(items.get(key).sound);
              },
            },
            items.get(key).answer,
          ),
        ),
      ),
      h('p', { class: 'credit' }, sv.voiceCredit),
    ];
  }
}
