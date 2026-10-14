import * as THREE from 'three';
import { Cat, catPicture } from './cat.js';
import { Capybara, capybaraPicture } from './capybara.js';
import { EXPRESSIONS } from './drawing.js';
import { DEFAULT_LOOK, paintOf, creatureOf } from '../look.js';

// Each creature in the catalog: its 3D body and its flat picture for the menus.
const KINDS = {
  cat: { Body: Cat, picture: catPicture },
  capybara: { Body: Capybara, picture: capybaraPicture },
};

// A creature's body on its own, without the Pet around it (for figurines).
export const makeBody = (id) => new KINDS[id].Body();

// A flat picture of a look's head, as an image URL.
export function picture(look, expression = 'open') {
  return KINDS[creatureOf(look).id].picture(paintOf(look), EXPRESSIONS[expression]);
}

// The player's pet in the game: whichever creature the look asks for, dressed in it.
// Bodies are built the first time they are needed and kept for switching back.
export class Pet extends THREE.Group {
  constructor(look = DEFAULT_LOOK) {
    super();
    this.bodies = new Map();
    this.body = null;
    this.look = look;
    this.party = null;
    this.gaze = null;
    this.show(look);
  }

  show(look) {
    const kind = creatureOf(look).id;
    if (!this.bodies.has(kind)) this.bodies.set(kind, new KINDS[kind].Body());
    const body = this.bodies.get(kind);
    if (body !== this.body) {
      if (this.body) this.remove(this.body);
      this.body = body;
      this.add(body);
      body.watch(this.gaze);
    }
    body.dancing = Boolean(this.party);
    body.setLook(look);
  }

  setLook(look) {
    this.look = look;
    if (!this.party) this.show(look);
  }

  // A party is a dance that keeps going, in a party outfit to show off (see partyLook).
  setParty(on, look) {
    this.party = on ? look : null;
    this.show(this.party ?? this.look);
  }

  play(name) {
    this.body.play(name);
  }

  // A point in the world to watch, or null to face forward.
  watch(point) {
    this.gaze = point;
    this.body.watch(point);
  }

  headPosition(target) {
    return this.body.headPosition(target);
  }

  update(dt, t) {
    this.body.update(dt, t);
  }
}
