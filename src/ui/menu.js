import { sv } from '../i18n/sv.js';
import { DECKS, UPCOMING_DECKS } from '../decks/index.js';
import { listProfiles, createProfile, deleteProfile, selectTrack, save } from '../profiles.js';
import { letterLevel } from '../decks/letters.js';
import { levelStars } from '../learner.js';
import { DEFAULT_LOOK, newLook, paletteOf } from '../wardrobe/look.js';
import { picture } from '../wardrobe/creatures/index.js';
import { say, unlockAudio } from '../audio.js';

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (value === true) el.setAttribute(key, '');
    else if (value !== false && value != null) el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((child) => child != null && child !== false));
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
const LEVEL_COLORS = { pink: 'pink', blue: 'blue', orange: 'orange', green: 'mint', purple: 'purple' };
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

// The 2D pages shown before the game: pick a player, pick a subject, pick a level.
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
    if (this.screen === 'levels') this.render();
  }

  setXRAvailable(available) {
    this.xrAvailable = available;
    if (this.screen === 'levels') this.render();
  }

  show() {
    this.root.hidden = false;
    this.go(this.profile ? 'levels' : 'profiles');
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

  choose(profile, screen = 'games') {
    const deck = DECKS[profile.track];
    this.profile = profile;
    this.level = deck.levels.find((level) => level.id === profile.lastLevel) ?? deck.levels[0];
    this.go(screen, 'wave');
  }

  practiceLevel(level = this.level) {
    return this.profile.track === 'bokstaver' ? letterLevel(this.profile, level) : level;
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
      if (name) this.choose(createProfile(name, track, look), 'levels');
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

  // Big sticker tiles: the subjects with how many stars there are to get, and the room.
  games() {
    const { profile } = this;
    const tiles = Object.values(DECKS).map((deck) => {
      const [art, color] = DECK_ART[deck.id] ?? [deck.name[0], 'purple'];
      const earned = deck.levels.reduce((sum, level) => sum + levelStars(profile, level), 0);
      return h(
        'button',
        {
          class: `tile c-${color}`,
          onclick: () => {
            selectTrack(profile, deck.id);
            this.level = deck.levels.find((level) => level.id === profile.lastLevel) ?? deck.levels[0];
            this.go('levels');
          },
        },
        h('span', { class: 'art' }, art),
        h('span', { class: 'label' }, deck.name),
        h('span', { class: 'progress' }, `★ ${earned}/${deck.levels.length * 3}`),
      );
    });
    const room = h(
      'button',
      { class: 'tile c-orange', onclick: () => this.onRoom(profile) },
      h('span', { class: 'art emoji' }, '🏠'),
      h('span', { class: 'label' }, sv.room),
      profile.fresh.length > 0 ? h('span', { class: 'progress new' }, sv.newTag) : h('span', { class: 'progress' }, `${profile.coins} 🪙`),
    );
    const upcoming = UPCOMING_DECKS.map((name) =>
      h(
        'div',
        { class: 'tile locked' },
        h('span', { class: 'art emoji' }, '🔒'),
        h('span', { class: 'label' }, name),
        h('span', { class: 'progress' }, sv.comingSoon),
      ),
    );
    return [sticker('h2', sv.whatGame), h('div', { class: 'tiles' }, tiles, room, upcoming)];
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

  // The levels as stops along a winding path, with the pet standing on the chosen one.
  levels() {
    const { profile } = this;
    const deck = DECKS[profile.track];
    const xOf = (i) => 50 + Math.sin(i * 1.15) * 27;
    const yOf = (i) => 120 + i * STOP_GAP;
    const height = yOf(deck.levels.length - 1) + 90;
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
          class: `stop c-${LEVEL_COLORS[level.color] ?? 'purple'}${selected ? ' selected' : ''}`,
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
        h('span', { class: 'disc' }, level.badge),
        stars(levelStars(profile, this.practiceLevel(level))),
        h('span', { class: 'name' }, level.name),
      );
    });

    const play = (useXR) => () => this.onStart(profile, this.practiceLevel(), useXR);
    const vr = this.xrAvailable || this.xrSupported;
    const remove = () => {
      if (!confirm(sv.confirmDelete(profile.name))) return;
      deleteProfile(profile.id);
      this.profile = null;
      this.go('profiles');
    };
    return [
      h(
        'div',
        { class: 'bar' },
        roundButton('←', sv.switchGame, () => this.go('games')),
        sticker('h2', deck.name),
        deck.soundboard ? roundButton('🔊', sv.listen, () => this.go('listen'), 'sound') : h('span', { class: 'round spacer' }),
      ),
      h('div', { class: 'trail' }, h('div', { class: 'path', style: `height: ${height}px` }, svg, stops)),
      deck.id === 'bokstaver' && this.letterOptions(),
      this.error && h('p', { class: 'error' }, this.error),
      h(
        'div',
        { class: 'plays' },
        h('button', { class: 'btn go play', onclick: play(this.xrSupported) }, this.xrSupported ? `🥽 ${sv.play}` : `▶ ${sv.play}`),
        vr && h('button', { class: 'btn alt', onclick: play(!this.xrSupported) }, this.xrSupported ? sv.onScreen : `🥽 ${sv.inVR}`),
      ),
      h('button', { class: 'quiet', onclick: remove }, sv.deletePlayer),
    ];
  }

  // Every item of a spoken game as a bubble that says it: for exploring, and for checking the clips.
  listen() {
    const deck = DECKS[this.profile.track];
    const items = new Map(deck.levels.flatMap((level) => level.items).map((item) => [item.key, item]));
    const keys = [...items.keys()].sort((a, b) => a.localeCompare(b, 'sv'));
    return [
      h('div', { class: 'bar' }, roundButton('←', sv.back, () => this.go('levels')), sticker('h2', sv.listenTitle), h('span', { class: 'round spacer' })),
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
