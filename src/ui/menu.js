import { sv } from '../i18n/sv.js';
import { DECKS, UPCOMING_DECKS } from '../decks/index.js';
import { listProfiles, createProfile, deleteProfile, selectTrack, save } from '../profiles.js';
import { letterLevel } from '../decks/letters.js';
import { levelStars } from '../learner.js';
import { isUnlocked, lockText } from '../wardrobe/unlocks.js';
import { CREATURES, ITEMS, nameOf } from '../wardrobe/catalog.js';
import { DEFAULT_LOOK, newLook, paletteOf, isWorn, asCreature } from '../wardrobe/look.js';
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
  const key = `${look.creature}/${look.paint.fur}/${expression}`;
  if (!pictures.has(key)) pictures.set(key, picture(look, expression));
  return h('img', { class: 'avatar', src: pictures.get(key), alt: '' });
}

const hex = (number) => `#${number.toString(16).padStart(6, '0')}`;

// Three stars per level, filled as the facts in it are learned.
function rating(stars) {
  return h('span', { class: 'rating' }, '★'.repeat(stars), h('span', { class: 'off' }, '★'.repeat(3 - stars)));
}

// The 2D pages shown before the game: pick a player, dress the pet, pick a level.
// `onPreview(look, move)` shows that pet next to the menu.
export class Menu {
  constructor(root, { onStart, onPreview }) {
    this.root = root;
    this.onStart = onStart;
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

  render(preserveScroll = true) {
    const card = this.root.firstElementChild ?? h('div', { class: 'card' });
    const scrollTop = preserveScroll ? card.scrollTop : 0;
    const small = ['games', 'levels', 'listen'].includes(this.screen);
    const logo = h(
      'div',
      { class: small ? 'logo small' : 'logo' },
      avatar(this.profile && small ? this.profile.look : DEFAULT_LOOK, 'happy'),
      h('h1', {}, h('span', {}, sv.title)),
    );
    card.replaceChildren(logo, ...[this[this.screen]()].flat(Infinity).filter((child) => child != null && child !== false));
    if (!card.parentNode) this.root.append(card);
    card.scrollTop = scrollTop;
  }

  games() {
    return [
      h('h2', {}, sv.hello(this.profile.name)),
      h('h3', {}, sv.whatGame),
      ...Object.values(DECKS).map((deck) => h('button', {
        class: 'btn ghost',
        onclick: () => {
          selectTrack(this.profile, deck.id);
          this.level = deck.levels.find((level) => level.id === this.profile.lastLevel) ?? deck.levels[0];
          this.go('levels');
        },
      }, deck.name)),
      h('button', { class: 'link', onclick: () => this.go('profiles') }, sv.switchPlayer),
    ];
  }

  letterOptions() {
    const { profile, level } = this;
    const practice = this.practiceLevel();
    const unlocked = profile.letterUnlocks.includes(level.id);
    const known = level.items.filter((item) => (profile.stats[item.key]?.box ?? 0) >= 2).length;
    return [
      h('h3', {}, sv.letterForm),
      h('div', { class: 'chips' }, Object.entries(sv.letterForms).map(([mode, label]) => h('button', {
        class: `chip${practice.letterCase === mode ? ' selected' : ''}${mode !== 'both' && !unlocked ? ' locked' : ''}`,
        disabled: mode !== 'both' && !unlocked,
        'aria-pressed': String(practice.letterCase === mode),
        onclick: () => {
          profile.letterModes[level.id] = mode;
          save();
          this.render();
        },
      }, label))),
      h('p', { class: 'hint' }, unlocked ? sv.letterFormReady : sv.letterFormLocked(known, level.items.length)),
    ];
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
              onpointerenter: () => this.onPreview(profile.look),
            },
            avatar(profile.look),
            h('span', { class: 'name' }, profile.name),
            h('span', { class: 'pill' }, `⭐ ${profile.stars}`),
          ),
        ),
      ),
      h('button', { class: 'btn ghost', onclick: () => this.go('create') }, sv.newPlayer),
    ];
  }

  create() {
    const look = newLook();
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
    const swatches = Object.keys(paletteOf(look)).map((id) =>
      h(
        'button',
        {
          type: 'button',
          class: id === look.paint.fur ? 'swatch selected' : 'swatch',
          title: sv.colors[id],
          onclick: (event) => {
            look.paint.fur = id;
            swatches.forEach((swatch) => swatch.classList.toggle('selected', swatch === event.currentTarget));
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

  // The pet's wardrobe: which creature it is, its colour and what it wears.
  wardrobe() {
    const { profile } = this;
    const { look } = profile;
    const dress = (change, move) => {
      Object.assign(look, change);
      save();
      this.render();
      this.onPreview(look, move);
    };
    // A button for something to pick, locked until it is earned and marked while new.
    const choice = (entry, { selected, icon, onpick }) => {
      const locked = !isUnlocked(profile, entry);
      const fresh = profile.fresh.includes(entry.id);
      return h(
        'button',
        {
          class: `chip${selected ? ' selected' : ''}${locked ? ' locked' : ''}${fresh ? ' fresh' : ''}`,
          disabled: locked,
          onclick: () => {
            profile.fresh = profile.fresh.filter((id) => id !== entry.id);
            onpick();
          },
        },
        icon,
        locked ? `🔒 ${lockText(profile, entry)}` : nameOf(entry) ?? sv.nothingOn,
        fresh && h('span', { class: 'tag' }, sv.newTag),
      );
    };
    return [
      h('h3', {}, sv.wardrobe),
      CREATURES.length > 1 &&
        h(
          'div',
          { class: 'chips' },
          CREATURES.map((creature) =>
            choice(creature, {
              selected: look.creature === creature.id,
              icon: avatar(asCreature(look, creature.id)),
              onpick: () => look.creature !== creature.id && dress(asCreature(look, creature.id), 'wave'),
            }),
          ),
        ),
      h(
        'div',
        { class: 'dots' },
        Object.entries(paletteOf(look)).map(([id, colors]) =>
          h('button', {
            class: id === look.paint.fur ? 'dot selected' : 'dot',
            style: `background: ${hex(colors.fur)}`,
            title: sv.colors[id],
            onclick: () => dress({ paint: { ...look.paint, fur: id } }, 'hop'),
          }),
        ),
      ),
      h(
        'div',
        { class: 'chips' },
        choice({ id: 'none' }, {
          selected: Object.keys(look.wear).length === 0,
          icon: avatar(look),
          onpick: () => dress({ wear: {} }, 'spin'),
        }),
        ITEMS.map((item) =>
          choice(item, {
            selected: isWorn(look, item),
            icon: h('span', {}, item.icon),
            // One thing at a time for now; the slots allow more later.
            onpick: () => dress({ wear: { [item.slot]: item.id } }, 'spin'),
          }),
        ),
      ),
    ];
  }

  levels() {
    const { profile } = this;
    const deck = DECKS[profile.track];
    const remove = () => {
      if (!confirm(sv.confirmDelete(profile.name))) return;
      deleteProfile(profile.id);
      this.profile = null;
      this.go('profiles');
    };
    return [
      h('button', { class: 'btn ghost small back', onclick: () => this.go('games') }, sv.switchGame),
      h('h2', {}, sv.hello(profile.name), ' ', h('span', { class: 'pill' }, `⭐ ${profile.stars}`)),
      this.wardrobe(),
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
                profile.lastLevel = level.id;
                profile.lastLevels[deck.id] = level.id;
                save();
                this.render();
              },
            },
            h('span', { class: 'badge' }, level.badge),
            h('span', {}, level.name, rating(levelStars(profile, this.practiceLevel(level)))),
          ),
        ),
      ),
      deck.id === 'bokstaver' && this.letterOptions(),
      this.error && h('p', { class: 'error' }, this.error),
      h('p', { class: 'hint' }, sv.how[deck.id][this.xrSupported ? 'xr' : 'screen']),
      h(
        'div',
        { class: 'starts' },
        (this.xrAvailable || this.xrSupported) &&
          h('button', { class: this.xrSupported ? 'btn go' : 'btn ghost', onclick: () => this.onStart(profile, this.practiceLevel(), true) }, sv.startXR),
        h(
          'button',
          { class: this.xrSupported ? 'btn ghost' : 'btn go', onclick: () => this.onStart(profile, this.practiceLevel(), false) },
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
