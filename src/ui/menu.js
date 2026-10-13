import { sv } from '../i18n/sv.js';
import { DECKS, UPCOMING_DECKS } from '../decks/index.js';
import { listProfiles, createProfile, deleteProfile, save } from '../profiles.js';
import { levelStars } from '../learner.js';
import { isUnlocked, lockText } from '../rewards.js';
import { CAT_COLORS, ACCESSORIES, DEFAULT_LOOK } from '../cats.js';
import { avatarURL } from '../game/faces.js';
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
function avatar(color, expression = 'open') {
  const key = `${color}/${expression}`;
  if (!pictures.has(key)) pictures.set(key, avatarURL(CAT_COLORS[color] ?? CAT_COLORS[DEFAULT_LOOK.color], expression));
  return h('img', { class: 'avatar', src: pictures.get(key), alt: '' });
}

const hex = (number) => `#${number.toString(16).padStart(6, '0')}`;

// Three stars per level, filled as the facts in it are learned.
function rating(stars) {
  return h('span', { class: 'rating' }, '★'.repeat(stars), h('span', { class: 'off' }, '★'.repeat(3 - stars)));
}

// The 2D pages shown before the game: pick a player, dress the kitten, pick a level.
// `onPreview(look, move)` shows that kitten next to the menu.
export class Menu {
  constructor(root, { onStart, onPreview }) {
    this.root = root;
    this.onStart = onStart;
    this.onPreview = onPreview;
    this.xrSupported = false;
    this.screen = 'profiles';
    this.profile = null;
    this.level = null;
    this.error = null;
    this.go('profiles');
  }

  setXRSupported(supported) {
    this.xrSupported = supported;
    this.render();
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
    this.render();
    this.onPreview(this.profile && this.screen !== 'profiles' && this.screen !== 'create' ? this.profile.cat : DEFAULT_LOOK, move);
  }

  choose(profile) {
    const deck = DECKS[profile.track];
    this.profile = profile;
    this.level = deck.levels.find((level) => level.id === profile.lastLevel) ?? deck.levels[0];
    this.go('levels', 'wave');
  }

  render() {
    const small = this.screen === 'levels' || this.screen === 'listen';
    const logo = h(
      'div',
      { class: small ? 'logo small' : 'logo' },
      avatar(this.profile && small ? this.profile.cat.color : DEFAULT_LOOK.color, 'happy'),
      h('h1', {}, [...sv.title].map((letter, i) => h('span', { style: `--i: ${i}` }, letter))),
    );
    this.root.replaceChildren(h('div', { class: 'card' }, logo, this[this.screen]()));
  }

  profiles() {
    return [
      h('h2', {}, sv.whoPlays),
      h(
        'div',
        { class: 'players' },
        listProfiles().map((profile) =>
          h(
            'button',
            {
              class: 'player',
              onclick: () => this.choose(profile),
              onpointerenter: () => this.onPreview(profile.cat),
            },
            avatar(profile.cat.color),
            h('span', { class: 'name' }, profile.name),
            h('span', { class: 'pill' }, `⭐ ${profile.stars}`),
          ),
        ),
      ),
      h('button', { class: 'btn ghost', onclick: () => this.go('create') }, sv.newPlayer),
    ];
  }

  create() {
    let color = DEFAULT_LOOK.color;
    let track = Object.keys(DECKS)[0];
    const tracks = Object.values(DECKS).map((deck) =>
      h(
        'button',
        {
          type: 'button',
          class: deck.id === track ? 'chip selected' : 'chip',
          onclick: (event) => {
            track = deck.id;
            tracks.forEach((chip) => chip.classList.toggle('selected', chip === event.currentTarget));
          },
        },
        deck.name,
      ),
    );
    const input = h('input', { type: 'text', maxlength: 14, autocomplete: 'off' });
    const swatches = Object.keys(CAT_COLORS).map((id) =>
      h(
        'button',
        {
          type: 'button',
          class: id === color ? 'swatch selected' : 'swatch',
          title: sv.catColors[id],
          onclick: (event) => {
            color = id;
            swatches.forEach((swatch) => swatch.classList.toggle('selected', swatch === event.currentTarget));
            this.onPreview({ ...DEFAULT_LOOK, color }, 'hop');
          },
        },
        avatar(id),
      ),
    );
    const submit = (event) => {
      event.preventDefault();
      const name = input.value.trim();
      if (name) this.choose(createProfile(name, track, { color }));
      else input.focus();
    };
    return h(
      'form',
      { onsubmit: submit },
      h('h2', {}, sv.yourName),
      input,
      h('h3', {}, sv.pickCat),
      h('div', { class: 'swatches' }, swatches),
      h('h3', {}, sv.whatGame),
      h(
        'div',
        { class: 'chips' },
        tracks,
        UPCOMING_DECKS.map((name) => h('span', { class: 'chip locked' }, `${name} (${sv.comingSoon})`)),
      ),
      h('button', { class: 'btn go', type: 'submit' }, sv.save),
      listProfiles().length > 0 &&
        h('button', { class: 'link', type: 'button', onclick: () => this.go('profiles') }, sv.cancel),
    );
  }

  // Every item of a spoken game as a button that says it: for exploring, and for checking the clips.
  listen() {
    const deck = DECKS[this.profile.track];
    const items = new Map(deck.levels.flatMap((level) => level.items).map((item) => [item.key, item]));
    const keys = [...items.keys()].sort((a, b) => a.localeCompare(b, 'sv'));
    return [
      h('h2', {}, sv.listenHint),
      h(
        'div',
        { class: 'letters' },
        keys.map((key) =>
          h(
            'button',
            {
              class: 'letter',
              onclick: () => {
                unlockAudio();
                say(items.get(key).sound);
              },
            },
            items.get(key).answer,
          ),
        ),
      ),
      h('button', { class: 'btn ghost', onclick: () => this.go('levels') }, sv.back),
      h('p', { class: 'credit' }, sv.voiceCredit),
    ];
  }

  levels() {
    const { profile } = this;
    const deck = DECKS[profile.track];
    const dress = (change, move) => {
      Object.assign(profile.cat, change);
      save();
      this.render();
      this.onPreview(profile.cat, move);
    };
    const remove = () => {
      if (!confirm(sv.confirmDelete(profile.name))) return;
      deleteProfile(profile.id);
      this.profile = null;
      this.go('profiles');
    };
    return [
      h('h2', {}, sv.hello(profile.name), ' ', h('span', { class: 'pill' }, `⭐ ${profile.stars}`)),
      h('h3', {}, sv.wardrobe),
      h(
        'div',
        { class: 'dots' },
        Object.entries(CAT_COLORS).map(([id, colors]) =>
          h('button', {
            class: id === profile.cat.color ? 'dot selected' : 'dot',
            style: `background: ${hex(colors.fur)}`,
            title: sv.catColors[id],
            onclick: () => dress({ color: id }, 'hop'),
          }),
        ),
      ),
      h(
        'div',
        { class: 'chips' },
        ACCESSORIES.map((item) => {
          const locked = !isUnlocked(profile, item);
          const selected = profile.cat.accessory === item.id;
          const fresh = profile.fresh.includes(item.id);
          return h(
            'button',
            {
              class: `chip${selected ? ' selected' : ''}${locked ? ' locked' : ''}${fresh ? ' fresh' : ''}`,
              disabled: locked,
              onclick: () => {
                profile.fresh = profile.fresh.filter((id) => id !== item.id);
                dress({ accessory: item.id }, 'spin');
              },
            },
            h('span', {}, item.icon),
            locked ? `🔒 ${lockText(profile, item)}` : sv.accessories[item.id],
            fresh && h('span', { class: 'tag' }, sv.newTag),
          );
        }),
      ),
      h('h3', {}, sv.whatPractice),
      deck.soundboard && h('button', { class: 'btn ghost small', onclick: () => this.go('listen') }, sv.listen),
      h(
        'div',
        { class: 'levels' },
        deck.levels.map((level) =>
          h(
            'button',
            {
              class: `level color-${level.color}${level === this.level ? ' selected' : ''}`,
              onclick: () => {
                this.level = level;
                this.render();
              },
            },
            h('span', { class: 'badge' }, level.badge),
            h('span', {}, level.name, rating(levelStars(profile, level))),
          ),
        ),
      ),
      this.error && h('p', { class: 'error' }, this.error),
      h('p', { class: 'hint' }, sv.how[deck.id][this.xrSupported ? 'xr' : 'screen']),
      h(
        'div',
        { class: 'starts' },
        this.xrSupported &&
          h('button', { class: 'btn go', onclick: () => this.onStart(profile, this.level, true) }, sv.startXR),
        h(
          'button',
          { class: this.xrSupported ? 'btn ghost' : 'btn go', onclick: () => this.onStart(profile, this.level, false) },
          sv.startScreen,
        ),
      ),
      h(
        'div',
        { class: 'links' },
        h('button', { class: 'link', onclick: () => this.go('profiles') }, sv.switchPlayer),
        h('button', { class: 'link', onclick: remove }, sv.deletePlayer),
      ),
    ];
  }
}
