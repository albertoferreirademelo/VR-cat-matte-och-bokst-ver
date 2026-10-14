import * as THREE from 'three';
import { buildHouse, podium, frame, mobile, toyChest, ROOM } from './house.js';
import { Wardrobe, FACE, shelfBoard } from './wardrobe.js';
import { Tag, itemDisplay, potDisplay, figurineDisplay, wandDisplay, balloonDisplay } from './displays.js';
import { Pet, makeBody, picture } from '../wardrobe/creatures/index.js';
import { CREATURES, ITEMS, COLORS, PALETTES, GEAR, GEAR_PALETTES, nameOf } from '../wardrobe/catalog.js';
import { dressedIn, isWearing, paletteOf, asCreature, creatureOf } from '../wardrobe/look.js';
import { withGear, isUsing } from '../wardrobe/gear.js';
import { buildWand } from '../wardrobe/wands.js';
import { owns, progressOf } from '../wardrobe/unlocks.js';
import { buy } from '../wardrobe/shop.js';
import { Board, BOARD_STYLES } from '../ui/board.js';
import { Effects } from '../game/effects.js';
import { sfx } from '../audio.js';
import { sv } from '../i18n/sv.js';

const SHELVES = [
  { id: 'clothes', icon: '👑' },
  { id: 'colors', icon: '🎨' },
  { id: 'creatures', icon: '🐾' },
  { id: 'toys', icon: '✨' },
];
const MOVES = { clothes: 'spin', colors: 'hop', creatures: 'wave', toys: 'clap' };
const TRICKS = ['hop', 'spin', 'flip', 'dance', 'clap', 'wave'];
const PET_SPOT = new THREE.Vector3(0, 0.2, -2.05);
const OFFER_Y = 1.45;
const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

// Which colour parts go on which door, and where each block of pots starts.
const COLOR_BLOCKS = [
  ['fur', 0, 0.82],
  ['eyes', 0, 0.02],
  ['paws', 1, 0.82],
  ['nose', 1, 0.02],
];
const DECORATION_BLOCKS = [
  ['stick', 0.85],
  ['glitter', 0.25],
  ['ribbon', -0.35],
];
const POT_COLUMNS = [-0.3, -0.1, 0.1, 0.3];

// The balloons over the toy chest: the shapes and colours each style shows.
const BALLOON_LOOKS = {
  mix: [['round', 'heart', 'star'], [0xf15bb5, 0x9b5de5, 0x4cc9f0]],
  round: [['round'], [0xff8fab]],
  cat: [['cat'], [0x9b5de5]],
  heart: [['heart'], [0xf15bb5]],
  star: [['star'], [0xff9f1c]],
  capybara: [['capybara'], [0xc8956a]],
  fish: [['fish'], [0x4cc9f0]],
  bubble: [['bubble'], [0x8fd3ff]],
};
const CHEST = new THREE.Vector3(-1.8, 0, -1.7);
const CHEST_TURN = 0.6;

// The pet's room: a wardrobe full of things to try on, buy or aim for, a toy chest with
// balloons, and the pet on a little stage. Tapping a thing tries it on; owned things stay on.
export class Room extends THREE.Group {
  // `onPurse(profile)` is told whenever the player's stars or coins may have changed.
  constructor(camera, { onSave, onPurse }) {
    super();
    this.visible = false;
    this.camera = camera;
    this.onSave = onSave;
    this.onPurse = onPurse;
    this.profile = null;
    this.shelf = 'clothes';
    this.trying = null;
    this.hovered = new Set();
    this.cameraPosition = new THREE.Vector3();
    this.gaze = new THREE.Vector3();

    this.add(buildHouse());
    this.wardrobe = new Wardrobe(SHELVES.map((shelf) => ({ ...shelf, label: sv.shelves[shelf.id] })));
    this.add(this.wardrobe);
    for (const [id, badge] of Object.entries(this.wardrobe.tabs)) badge.userData.onHit = () => this.showShelf(id);

    const stage = podium();
    stage.position.set(PET_SPOT.x, 0, PET_SPOT.z);
    this.pet = new Pet();
    this.pet.scale.setScalar(1.5);
    this.pet.position.copy(PET_SPOT);
    this.petHit = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.85, 12), hitMaterial);
    this.petHit.position.set(PET_SPOT.x, PET_SPOT.y + 0.42, PET_SPOT.z);
    this.petHit.userData.onHit = () => {
      sfx[creatureOf(this.pet.look).sound]();
      this.pet.play(TRICKS[Math.floor(Math.random() * TRICKS.length)]);
    };

    // A portrait of the pet on the wall.
    this.portrait = frame(0.55, 0.55);
    this.portrait.position.set(2.3, 1.35, ROOM.back + 0.03);
    this.portraitKey = null;

    // Above the pet while something is tried on: buy it, or how far there is to go.
    this.note = new Board(1.05, 0.3, BOARD_STYLES.note);
    this.buyButton = new Board(0.82, 0.22, BOARD_STYLES.button);
    this.buyButton.userData.onHit = () => this.buyTrying();
    this.cancelButton = new Board(0.16, 0.16, BOARD_STYLES.button);
    this.cancelButton.setText('✕');
    this.cancelButton.userData.onHit = () => this.stopTrying();
    for (const board of [this.note, this.buyButton]) board.position.set(0, OFFER_Y, -1.9);
    this.cancelButton.position.set(0.62, OFFER_Y, -1.88);
    this.buttons = [this.buyButton, this.cancelButton];

    // The player's wand, big beside the pet while the game's things are shown.
    this.wandShow = new THREE.Group();
    this.wandShow.position.set(0.58, 0.5, -1.8);
    this.wandLabel = new Tag();
    this.wandLabel.show(sv.yourWand);
    this.wandLabel.position.y = -0.08;
    this.wandShow.add(this.wandLabel);
    this.wandModel = null;
    this.wandKey = null;

    // A toy chest by the window, with the balloon styles floating out of it.
    this.chest = toyChest();
    this.chest.position.copy(CHEST);
    this.chest.rotation.y = CHEST_TURN;
    this.chestHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), hitMaterial);
    this.chestHit.position.set(CHEST.x, 0.25, CHEST.z);
    this.chestHit.rotation.y = CHEST_TURN;
    this.chestHit.userData.onHit = () => this.showShelf('toys');
    this.balloons = this.buildBalloons();

    this.mobile = mobile();
    this.mobile.position.set(0, ROOM.height - 0.3, -0.7);
    this.effects = new Effects();
    this.add(
      stage,
      this.pet,
      this.petHit,
      this.portrait,
      this.mobile,
      this.note,
      ...this.buttons,
      this.wandShow,
      this.chest,
      this.chestHit,
      ...this.balloons,
      this.effects,
    );

    // One group per shelf on each door; only the chosen shelf is shown.
    this.groups = {};
    this.displays = {};
    for (const { id } of SHELVES) {
      this.groups[id] = this.wardrobe.faces.map((face) => {
        const group = new THREE.Group();
        face.add(group);
        return group;
      });
      this.displays[id] = [];
    }
    this.buildClothes();
    this.buildCreatures();
    this.colorsFor = null;
    this.toysFor = null;
  }

  // Puts a display on a shelf of door `side` (0 left, 1 right) at height `y`.
  place(shelf, side, display, x, y, width) {
    display.position.set(x, y, 0);
    display.hit.userData.onHit = () => this.pick(display.entry, display);
    if (width) this.groups[shelf][side].add(shelfBoard(width, y));
    this.groups[shelf][side].add(display);
    this.displays[shelf].push(display);
  }

  // Empties a shelf that is rebuilt when something it shows changes.
  clearShelf(shelf) {
    for (const display of this.displays[shelf]) display.dispose();
    for (const group of this.groups[shelf]) group.clear();
    this.displays[shelf] = [];
  }

  // A labelled block of paint pots: `entries` are [entry, colours] pairs, four to a row.
  potBlock(shelf, side, top, label, entries) {
    const tag = new Tag(0.3, 0.08);
    tag.show(label);
    tag.position.set(0, top, 0.02);
    this.groups[shelf][side].add(tag);
    entries.forEach(([entry, colors], i) => {
      const y = top - (shelf === 'toys' ? 0.2 : 0.24) - Math.floor(i / 4) * (shelf === 'toys' ? 0.22 : 0.27);
      this.place(shelf, side, potDisplay(entry, colors), POT_COLUMNS[i % 4], y, i % 4 === 0 ? FACE.width * 0.9 : 0);
    });
  }

  buildClothes() {
    ITEMS.forEach((item, i) => {
      this.place('clothes', i < 3 ? 0 : 1, itemDisplay(item), 0, [0.42, -0.14, -0.7][i % 3], FACE.width * 0.8);
    });
  }

  buildCreatures() {
    CREATURES.forEach((creature, i) => {
      const body = makeBody(creature.id);
      body.scale.setScalar(0.95);
      this.place('creatures', i % 2, figurineDisplay(creature, body), 0, -0.3 + Math.floor(i / 2) * 0.9, FACE.width * 0.8);
    });
  }

  // Pots of paint. Fur colours depend on the creature, so this is redone when it changes.
  buildColors(look) {
    this.clearShelf('colors');
    for (const [part, side, top] of COLOR_BLOCKS) {
      const entries =
        part === 'fur'
          ? Object.entries(paletteOf(look)).map(([color, colors]) => [{ id: `fur:${color}`, part, color }, colors.fur])
          : [
              [{ id: `${part}:`, part, color: undefined }, null],
              ...COLORS.filter((entry) => entry.part === part).map((entry) => [entry, PALETTES[part][entry.color]]),
            ];
      this.potBlock('colors', side, top, sv.parts[part], entries);
    }
    this.colorsFor = look.creature;
  }

  // Wands on the left door, wearing the player's decorations, and the decorations on the right.
  buildToys(gear) {
    this.clearShelf('toys');
    const wands = GEAR.filter((entry) => entry.slot === 'wand');
    wands.forEach((entry, i) => {
      const row = Math.floor(i / 3);
      const inRow = row === 0 ? 3 : wands.length - 3;
      const x = ((i % 3) - (inRow - 1) / 2) * 0.27;
      this.place('toys', 0, wandDisplay(entry, withGear(gear, entry)), x, [0.28, -0.52][row], i % 3 === 0 ? FACE.width * 0.85 : 0);
    });
    for (const [slot, top] of DECORATION_BLOCKS) {
      const swatch = (value) => {
        const color = GEAR_PALETTES[slot][value];
        return Array.isArray(color) ? [color[2] ?? color[0], color[0]] : color;
      };
      const entries = [
        [{ id: `${slot}:`, slot, value: undefined, gear: true }, null],
        ...GEAR.filter((entry) => entry.slot === slot).map((entry) => [entry, swatch(entry.value)]),
      ];
      this.potBlock('toys', 1, top, sv.parts[slot], entries);
    }
    this.toysFor = decorations(gear);
  }

  buildBalloons() {
    return GEAR.filter((entry) => entry.slot === 'balloon').map((entry, i) => {
      const [shapes, colors] = BALLOON_LOOKS[entry.value];
      const display = balloonDisplay(entry, shapes, colors);
      const row = i % 2;
      const angle = CHEST_TURN;
      const across = (Math.floor(i / 2) - 1.5) * 0.19 + 0.07;
      display.position.set(
        CHEST.x + Math.cos(angle) * across - Math.sin(angle) * (row ? 0.06 : -0.12),
        row ? 0.95 : 1.28,
        CHEST.z - Math.sin(angle) * across - Math.cos(angle) * (row ? 0.06 : -0.12),
      );
      display.home = display.position.y;
      display.hit.userData.onHit = () => this.pick(entry, display);
      // A string from the balloon down into the chest.
      const string = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.07, 0), new THREE.Vector3(0, 0.4 - display.home, 0)]),
        new THREE.LineBasicMaterial({ color: 0xffffff }),
      );
      display.add(string);
      return display;
    });
  }

  open(profile) {
    this.profile = profile;
    this.trying = null;
    this.visible = true;
    this.pet.setLook(profile.look);
    this.pet.play('wave');
    this.showShelf(this.shelf, false);
  }

  close() {
    this.visible = false;
    this.trying = null;
    this.effects.clear();
  }

  showShelf(id, sound = true) {
    if (sound) sfx.bloop();
    this.shelf = id;
    for (const [shelf, groups] of Object.entries(this.groups)) for (const group of groups) group.visible = shelf === id;
    this.stopTrying(false);
  }

  // The displays that can be tapped now: the chosen shelf, and the balloons always.
  active() {
    return [...this.displays[this.shelf], ...this.balloons];
  }

  inUse(entry) {
    return entry.gear ? isUsing(this.profile.gear, entry) : isWearing(this.profile.look, entry);
  }

  pick(entry, display) {
    const { profile } = this;
    sfx.bloop();
    profile.fresh = profile.fresh.filter((id) => id !== entry.id);
    if (entry.gear) {
      this.show(entry, display);
      if (owns(profile, entry)) this.use(entry, MOVES.toys);
      else {
        this.trying = entry;
        this.refresh();
      }
      return;
    }
    const { look } = profile;
    const move = MOVES[this.shelf];
    if (!owns(profile, entry)) {
      this.trying = entry;
      this.pet.setLook(dressedIn(look, entry));
      this.pet.play(move);
      this.refresh();
    } else if (entry.slot && isWearing(look, entry)) {
      // Tapping something worn takes it off.
      const { [entry.slot]: _, ...wear } = look.wear;
      this.keep({ wear }, move);
    } else {
      this.keep(dressedIn(look, entry), move);
    }
  }

  // Shows what a thing for the game does: a balloon pops, a wand shoots sparkles.
  show(entry, display) {
    const at = display.getWorldPosition(new THREE.Vector3());
    if (entry.slot === 'balloon') {
      sfx.pop();
      this.effects.pop(at, display.color);
      display.grow = 0.05;
      return;
    }
    const wand = this.wandModel;
    const sparkles = entry.slot === 'wand' ? display.sparkles : buildWand(withGear(this.profile.gear, entry)).userData.sparkles;
    const from = entry.slot === 'wand' ? at.setY(at.y + display.tipHeight) : wand.getWorldPosition(new THREE.Vector3()).setY(1.15);
    const to = this.pet.headPosition();
    sfx.zap();
    this.effects.zap(from, to.clone().sub(from).normalize(), from.distanceTo(to), sparkles);
    this.effects.twinkle(to, sparkles[0]);
  }

  keep(change, move) {
    Object.assign(this.profile.look, change);
    this.trying = null;
    this.onSave();
    this.pet.setLook(this.profile.look);
    this.pet.play(move);
    this.refresh();
  }

  use(entry, move) {
    Object.assign(this.profile.gear, withGear(this.profile.gear, entry));
    this.trying = null;
    this.onSave();
    this.pet.play(move);
    this.refresh();
  }

  buyTrying() {
    const entry = this.trying;
    if (!entry || !buy(this.profile, entry)) return;
    sfx.combo();
    this.effects.hearts(this.pet.headPosition());
    this.effects.firework(new THREE.Vector3(0, 1.7, -2.3));
    if (entry.gear) this.use(entry, 'love');
    else this.keep(dressedIn(this.profile.look, entry), 'love');
  }

  stopTrying(sound = true) {
    if (sound) sfx.bloop();
    this.trying = null;
    if (this.profile) {
      this.pet.setLook(this.profile.look);
      this.refresh();
    }
  }

  // What a tag says about a thing: in use, owned, its price, or how far a goal is.
  tagFor(entry, label) {
    const { profile } = this;
    const owned = owns(profile, entry);
    if (owned && this.inUse(entry)) return { tag: '✓', style: 'worn' };
    if (owned && profile.fresh.includes(entry.id)) return { tag: sv.newTag, style: 'fresh' };
    if (owned) return { tag: label, style: 'label' };
    if (entry.price != null) return { tag: `${entry.price} 🪙`, style: 'price' };
    const progress = progressOf(profile, entry);
    if (!progress) return { tag: `🔒 ${sv.goals.perfectRound}`, style: 'goal' };
    return { tag: `🔒 ${progress.have}/${progress.need} ${entry.need.stars != null ? '⭐' : '★★★'}`, style: 'goal' };
  }

  // A plain pot's label: the thing keeps its own colour, or has no ribbon.
  plainLabel(entry) {
    if (entry.gear) return entry.value ? null : entry.slot === 'ribbon' ? sv.noRibbon : sv.plain;
    return entry.color ? null : sv.plain;
  }

  refresh() {
    const { profile } = this;
    const { look, gear } = profile;
    if (this.colorsFor !== look.creature) this.buildColors(look);
    if (this.toysFor !== decorations(gear)) this.buildToys(gear);
    const state = (display, label) => display.setState({ ...this.tagFor(display.entry, label), trying: this.trying === display.entry });
    for (const display of this.displays.clothes) state(display, nameOf(display.entry));
    for (const display of this.displays.colors) state(display, this.plainLabel(display.entry));
    for (const display of this.displays.creatures) {
      // The player's own animal as it is now; the others in their own fur.
      const own = display.entry.id === look.creature;
      display.body.setLook({ ...(own ? look : asCreature(look, display.entry.id)), wear: {} });
      state(display, nameOf(display.entry));
    }
    for (const display of this.displays.toys) state(display, display.entry.slot === 'wand' ? nameOf(display.entry) : this.plainLabel(display.entry));
    for (const display of this.balloons) state(display, nameOf(display.entry));

    this.onPurse(profile);
    const shown = this.trying && !this.trying.gear ? dressedIn(look, this.trying) : look;
    const key = JSON.stringify([shown.creature, shown.paint]);
    if (this.portraitKey !== key) {
      this.portraitKey = key;
      const material = this.portrait.userData.picture.material;
      material.map?.dispose();
      material.map = new THREE.TextureLoader().load(picture(shown, 'happy'));
      material.map.colorSpace = THREE.SRGBColorSpace;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    }

    // The big wand shows the gear as it would be with what is being tried.
    const wandGear = this.trying?.gear && this.trying.slot !== 'balloon' ? withGear(gear, this.trying) : gear;
    const wandKey = JSON.stringify(wandGear);
    if (this.wandKey !== wandKey) {
      this.wandKey = wandKey;
      if (this.wandModel) this.wandShow.remove(this.wandModel);
      this.wandModel = buildWand(wandGear, { upright: true });
      this.wandModel.rotation.x = Math.PI / 2;
      this.wandModel.scale.setScalar(2.3);
      this.wandShow.add(this.wandModel);
    }
    this.wandShow.visible = this.shelf === 'toys';

    const entry = this.trying;
    const affordable = entry?.price != null && profile.coins >= entry.price;
    this.buyButton.visible = affordable;
    if (affordable) this.buyButton.setText(sv.buy(entry.price));
    this.note.visible = Boolean(entry) && !affordable;
    if (this.note.visible) {
      if (entry.price != null) this.note.setText(sv.notEnough(profile.coins, entry.price));
      else this.note.setText(this.tagFor(entry).tag);
    }
    this.cancelButton.visible = Boolean(entry);
  }

  // The meshes a click or a wand can hit right now.
  targets() {
    if (!this.visible) return [];
    return [
      ...Object.values(this.wardrobe.tabs),
      ...this.active().map((display) => display.hit),
      this.petHit,
      this.chestHit,
      ...this.buttons.filter((button) => button.visible),
    ];
  }

  hit(mesh) {
    mesh.userData.onHit?.();
  }

  setHover(meshes) {
    this.hovered = meshes;
    for (const display of this.active()) display.hovered = meshes.has(display.hit);
    for (const button of this.buttons) button.hovered = meshes.has(button);
  }

  update(dt, t) {
    if (!this.visible) return;
    this.camera.getWorldPosition(this.cameraPosition);
    const aimed = this.active().find((display) => display.hovered);
    this.pet.watch(aimed ? aimed.getWorldPosition(this.gaze) : this.cameraPosition);
    this.pet.update(dt, t);
    for (const display of this.displays[this.shelf]) {
      display.update(dt, t);
      display.body?.update(dt, t);
    }
    this.balloons.forEach((display, i) => {
      display.update(dt, t);
      display.position.y = display.home + Math.sin(t * 1.4 + i * 1.3) * 0.025;
    });
    for (const [id, badge] of Object.entries(this.wardrobe.tabs)) {
      const target = id === this.shelf ? 1.22 : this.hovered.has(badge) ? 1.1 : 1;
      badge.scale.setScalar(badge.scale.x + (target - badge.scale.x) * Math.min(1, dt * 12));
      badge.position.y = badge.userData.base.y + (id === this.shelf ? Math.sin(t * 3) * 0.01 : 0);
    }
    for (const button of this.buttons) {
      const target = button.hovered ? 1.1 : 1;
      button.scale.setScalar(button.scale.x + (target - button.scale.x) * Math.min(1, dt * 12));
    }
    this.buyButton.position.y = OFFER_Y + Math.sin(t * 3) * 0.012;
    if (this.wandModel) this.wandModel.rotation.z = t * 0.8;
    this.chest.userData.lid.rotation.x = -1.9 + (this.shelf === 'toys' ? Math.sin(t * 4) * 0.06 : 0);
    this.mobile.rotation.y = t * 0.3;
    this.effects.update(dt, this.cameraPosition);
  }
}

// The decorations of a gear, as a key that changes when any of them does.
const decorations = (gear) => JSON.stringify([gear.stick, gear.glitter, gear.ribbon]);
