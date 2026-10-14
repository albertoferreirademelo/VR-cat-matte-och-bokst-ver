import { sv } from '../i18n/sv.js';
import { DECKS, UPCOMING_DECKS } from '../decks/index.js';
import { listProfiles, createProfile, deleteProfile, selectTrack, save } from '../profiles.js';
import { letterLevel } from '../decks/letters.js';
import { levelStars } from '../learner.js';
import { owns, goalText, progressOf } from '../wardrobe/unlocks.js';
import { buy } from '../wardrobe/shop.js';
import { CREATURES, ITEMS, COLORS, PARTS, PALETTES, nameOf } from '../wardrobe/catalog.js';
import { DEFAULT_LOOK, newLook, paletteOf, dressedIn, isWearing, asCreature } from '../wardrobe/look.js';
import { picture } from '../wardrobe/creatures/index.js';
import { say, sfx, unlockAudio } from '../audio.js';

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

const hex = (number) => `#${number.toString(16).padStart(6, '0')}`;

// A bar that fills towards a goal.
function meter(have, need) {
  return h('div', { class: 'meter' }, h('span', { style: `width: ${Math.min(100, (100 * have) / need)}%` }));
}

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
    this.shelf = 'clothes';
    this.trying = null; // something in the room tried on but not owned
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
    const small = ['games', 'levels', 'listen', 'room'].includes(this.screen);
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

  // The pet's room: everything to be, paint and wear, whether it is owned, for sale or a goal.
  // Tapping a thing tries it on. Owned things stay on; the rest can be bought or aimed for.
  room() {
    const { profile } = this;
    const { look } = profile;
    const keep = (change, move) => {
      Object.assign(look, change);
      this.trying = null;
      save();
      this.render();
      this.onPreview(look, move);
    };
    const pick = (entry, move) => {
      profile.fresh = profile.fresh.filter((id) => id !== entry.id);
      if (!owns(profile, entry)) {
        this.trying = entry;
        this.render();
        this.onPreview(dressedIn(look, entry), move);
      } else if (entry.slot && isWearing(look, entry)) {
        // Tapping something worn takes it off.
        const { [entry.slot]: _, ...wear } = look.wear;
        keep({ wear }, move);
      } else {
        keep(dressedIn(look, entry), move);
      }
    };
    const state = (entry) => {
      const owned = owns(profile, entry);
      return [
        owned && isWearing(look, entry) ? 'selected' : '',
        this.trying === entry ? 'trying' : '',
        owned ? '' : entry.price != null ? 'for-sale' : 'goal',
        profile.fresh.includes(entry.id) ? 'fresh' : '',
      ].join(' ');
    };
    const card = (entry, icon, move) =>
      h(
        'button',
        { class: `chip ${state(entry)}`, onclick: () => pick(entry, move) },
        icon,
        nameOf(entry),
        !owns(profile, entry) && h('span', { class: 'price' }, entry.price != null ? `${entry.price} 🪙` : '🔒'),
        profile.fresh.includes(entry.id) && h('span', { class: 'tag' }, sv.newTag),
      );
    const swatch = (part, color) => {
      if (part === 'fur') return hex(paletteOf(look)[color].fur);
      const value = PALETTES[part][color];
      return Array.isArray(value) ? `linear-gradient(${value[1]}, ${value[0]})` : hex(value);
    };
    // Fur colours are free; the other parts start in the pet's own colour ("Vanlig").
    const colorRow = (part) => {
      const entries =
        part === 'fur'
          ? Object.keys(paletteOf(look)).map((color) => ({ id: `fur:${color}`, part, color }))
          : [{ id: `${part}:`, part, color: undefined }, ...COLORS.filter((entry) => entry.part === part)];
      return h(
        'div',
        { class: 'paint' },
        h('span', { class: 'part' }, sv.parts[part]),
        h(
          'div',
          { class: 'dots' },
          entries.map((entry) =>
            h('button', {
              class: `dot ${entry.color ? '' : 'plain'} ${state(entry)}`,
              style: entry.color ? `background: ${swatch(part, entry.color)}` : null,
              title: entry.color ? sv.colors[entry.color] : sv.plain,
              onclick: () => pick(entry, 'hop'),
            }),
          ),
        ),
      );
    };
    const shelves = {
      creatures: () =>
        h('div', { class: 'chips' }, CREATURES.map((creature) => card(creature, avatar(asCreature(look, creature.id)), 'wave'))),
      colors: () => PARTS.map(colorRow),
      clothes: () =>
        h(
          'div',
          { class: 'chips' },
          h(
            'button',
            { class: `chip${Object.keys(look.wear).length ? '' : ' selected'}`, onclick: () => keep({ wear: {} }, 'spin') },
            avatar(look),
            sv.nothingOn,
          ),
          ITEMS.map((item) => card(item, h('span', {}, item.icon), 'spin')),
        ),
    };
    return [
      h('button', { class: 'btn ghost small back', onclick: () => this.go('levels') }, `← ${sv.back}`),
      h(
        'h2',
        {},
        sv.room,
        ' ',
        h('span', { class: 'pill' }, `⭐ ${profile.stars}`),
        ' ',
        h('span', { class: 'pill coins' }, `${profile.coins} 🪙`),
      ),
      h(
        'div',
        { class: 'chips tabs' },
        Object.entries(sv.shelves).map(([id, label]) =>
          h(
            'button',
            {
              class: `chip${this.shelf === id ? ' selected' : ''}`,
              onclick: () => {
                this.shelf = id;
                this.trying = null;
                this.render();
                this.onPreview(look);
              },
            },
            label,
          ),
        ),
      ),
      this.trying ? this.offer(this.trying, keep) : h('p', { class: 'hint' }, sv.roomHint),
      shelves[this.shelf](),
    ];
  }

  // What it takes to keep something being tried on: a buy button, the coins still
  // missing, or the progress towards a goal.
  offer(entry, keep) {
    const { profile } = this;
    const stop = () => {
      this.trying = null;
      this.render();
      this.onPreview(profile.look);
    };
    let deal;
    if (entry.price != null && profile.coins >= entry.price) {
      deal = h(
        'button',
        {
          class: 'btn go',
          onclick: () => {
            if (!buy(profile, entry)) return;
            sfx.combo();
            keep(dressedIn(profile.look, entry), 'love');
          },
        },
        sv.buy(entry.price),
      );
    } else if (entry.price != null) {
      deal = [h('p', {}, sv.saving(profile.coins, entry.price)), meter(profile.coins, entry.price)];
    } else {
      const progress = progressOf(profile, entry);
      deal = [h('p', {}, `🔒 ${goalText(profile, entry)}`), progress && meter(progress.have, progress.need)];
    }
    return h('div', { class: 'offer' }, deal, h('button', { class: 'link', onclick: stop }, sv.cancel));
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
      h('h2', {}, sv.hello(profile.name), ' ', h('span', { class: 'pill' }, `⭐ ${profile.stars}`), ' ', h('span', { class: 'pill coins' }, `${profile.coins} 🪙`)),
      h(
        'button',
        {
          class: 'btn ghost door',
          onclick: () => {
            this.trying = null;
            this.go('room');
          },
        },
        `🏠 ${sv.room}`,
        profile.fresh.length > 0 && h('span', { class: 'tag' }, sv.newTag),
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
