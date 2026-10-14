import * as THREE from 'three';
import { buildHouse, podium, frame, mobile, ROOM } from './house.js';
import { Wardrobe, FACE, shelfBoard } from './wardrobe.js';
import { Tag, itemDisplay, potDisplay, figurineDisplay } from './displays.js';
import { Pet, makeBody, picture } from '../wardrobe/creatures/index.js';
import { CREATURES, ITEMS, COLORS, PALETTES, nameOf } from '../wardrobe/catalog.js';
import { dressedIn, isWearing, paletteOf, asCreature, creatureOf } from '../wardrobe/look.js';
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
];
const MOVES = { clothes: 'spin', colors: 'hop', creatures: 'wave' };
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
const POT_COLUMNS = [-0.3, -0.1, 0.1, 0.3];

// The pet's room: a wardrobe full of things to try on, buy or aim for, and the pet
// on a little stage in front of it. Tapping a thing tries it on; owned things stay on.
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

    this.mobile = mobile();
    this.mobile.position.set(0, ROOM.height - 0.3, -0.7);
    this.effects = new Effects();
    this.add(stage, this.pet, this.petHit, this.portrait, this.mobile, this.note, ...this.buttons, this.effects);

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
  }

  // Puts a display on a shelf of door `side` (0 left, 1 right) at height `y`.
  place(shelf, side, display, x, y, width) {
    display.position.set(x, y, 0);
    display.hit.userData.onHit = () => this.pick(display.entry);
    this.groups[shelf][side].add(shelfBoard(width, y + 0.0), display);
    this.displays[shelf].push(display);
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
    for (const display of this.displays.colors) display.dispose();
    for (const group of this.groups.colors) group.clear();
    this.displays.colors = [];
    for (const [part, side, top] of COLOR_BLOCKS) {
      const label = new Tag(0.3, 0.08);
      label.show(sv.parts[part]);
      label.position.set(0, top, 0.02);
      this.groups.colors[side].add(label);
      const entries =
        part === 'fur'
          ? Object.entries(paletteOf(look)).map(([color, colors]) => [{ id: `fur:${color}`, part, color }, colors.fur])
          : [
              [{ id: `${part}:`, part, color: undefined }, null],
              ...COLORS.filter((entry) => entry.part === part).map((entry) => [entry, PALETTES[part][entry.color]]),
            ];
      entries.forEach(([entry, colors], i) => {
        const row = Math.floor(i / 4);
        const y = top - 0.24 - row * 0.27;
        if (i % 4 === 0) this.groups.colors[side].add(shelfBoard(FACE.width * 0.9, y));
        const display = potDisplay(entry, colors);
        display.position.set(POT_COLUMNS[i % 4], y, 0);
        display.hit.userData.onHit = () => this.pick(entry);
        this.groups.colors[side].add(display);
        this.displays.colors.push(display);
      });
    }
    this.colorsFor = look.creature;
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

  pick(entry) {
    const { profile } = this;
    const { look } = profile;
    const move = MOVES[this.shelf];
    sfx.bloop();
    profile.fresh = profile.fresh.filter((id) => id !== entry.id);
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

  keep(change, move) {
    Object.assign(this.profile.look, change);
    this.trying = null;
    this.onSave();
    this.pet.setLook(this.profile.look);
    this.pet.play(move);
    this.refresh();
  }

  buyTrying() {
    const entry = this.trying;
    if (!entry || !buy(this.profile, entry)) return;
    sfx.combo();
    this.effects.hearts(this.pet.headPosition());
    this.effects.firework(new THREE.Vector3(0, 1.7, -2.3));
    this.keep(dressedIn(this.profile.look, entry), 'love');
  }

  stopTrying(sound = true) {
    if (sound) sfx.bloop();
    this.trying = null;
    if (this.profile) {
      this.pet.setLook(this.profile.look);
      this.refresh();
    }
  }

  // What a tag says about a thing: worn, owned, its price, or how far a goal is.
  tagFor(entry, label) {
    const { profile } = this;
    const owned = owns(profile, entry);
    if (owned && isWearing(profile.look, entry)) return { tag: '✓', style: 'worn' };
    if (owned && profile.fresh.includes(entry.id)) return { tag: sv.newTag, style: 'fresh' };
    if (owned) return { tag: label, style: 'label' };
    if (entry.price != null) return { tag: `${entry.price} 🪙`, style: 'price' };
    const progress = progressOf(profile, entry);
    if (!progress) return { tag: `🔒 ${sv.goals.perfectRound}`, style: 'goal' };
    return { tag: `🔒 ${progress.have}/${progress.need} ${entry.need.stars != null ? '⭐' : '★★★'}`, style: 'goal' };
  }

  refresh() {
    const { profile } = this;
    const { look } = profile;
    if (this.colorsFor !== look.creature) this.buildColors(look);
    for (const display of this.displays.clothes) {
      display.setState({ ...this.tagFor(display.entry, nameOf(display.entry)), trying: this.trying === display.entry });
    }
    for (const display of this.displays.colors) {
      const label = display.entry.color ? null : sv.plain;
      display.setState({ ...this.tagFor(display.entry, label), trying: this.trying === display.entry });
    }
    for (const display of this.displays.creatures) {
      // The player's own animal as it is now; the others in their own fur.
      const own = display.entry.id === look.creature;
      display.body.setLook({ ...(own ? look : asCreature(look, display.entry.id)), wear: {} });
      display.setState({ ...this.tagFor(display.entry, nameOf(display.entry)), trying: this.trying === display.entry });
    }

    this.onPurse(profile);
    const shown = this.trying ? dressedIn(look, this.trying) : look;
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
      ...this.displays[this.shelf].map((display) => display.hit),
      this.petHit,
      ...this.buttons.filter((button) => button.visible),
    ];
  }

  hit(mesh) {
    mesh.userData.onHit?.();
  }

  setHover(meshes) {
    this.hovered = meshes;
    for (const display of this.displays[this.shelf]) display.hovered = meshes.has(display.hit);
    for (const button of this.buttons) button.hovered = meshes.has(button);
  }

  update(dt, t) {
    if (!this.visible) return;
    this.camera.getWorldPosition(this.cameraPosition);
    const aimed = this.displays[this.shelf].find((display) => display.hovered);
    this.pet.watch(aimed ? aimed.getWorldPosition(this.gaze) : this.cameraPosition);
    this.pet.update(dt, t);
    for (const display of this.displays[this.shelf]) {
      display.update(dt, t);
      display.body?.update(dt, t);
    }
    for (const [id, badge] of Object.entries(this.wardrobe.tabs)) {
      const target = id === this.shelf ? 1.22 : this.hovered?.has(badge) ? 1.1 : 1;
      badge.scale.setScalar(badge.scale.x + (target - badge.scale.x) * Math.min(1, dt * 12));
      badge.position.y = badge.userData.base.y + (id === this.shelf ? Math.sin(t * 3) * 0.01 : 0);
    }
    for (const button of this.buttons) {
      const target = button.hovered ? 1.1 : 1;
      button.scale.setScalar(button.scale.x + (target - button.scale.x) * Math.min(1, dt * 12));
    }
    this.buyButton.position.y = OFFER_Y + Math.sin(t * 3) * 0.012;
    this.mobile.rotation.y = t * 0.3;
    this.effects.update(dt, this.cameraPosition);
  }
}
