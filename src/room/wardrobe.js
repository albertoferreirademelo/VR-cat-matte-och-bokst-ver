import * as THREE from 'three';
import { toon } from '../game/toon.js';
import { FONT } from '../ui/board.js';
import { ROOM } from './house.js';

export const BODY = { width: 1.8, height: 1.95, depth: 0.55, feet: 0.06 };
export const DOOR = { width: 0.9, thickness: 0.04, open: THREE.MathUtils.degToRad(140) };
// The usable face of an open door, from its centre: x across, y up, +z out towards the room.
export const FACE = { width: 0.84, height: 1.84 };
const FRONT = ROOM.back + 0.02 + BODY.depth;

const paint = {
  body: toon(0xffd6ec),
  trim: toon(0xffffff),
  inside: toon(0xe3ccff),
  face: toon(0xfff6fb),
  gold: toon(0xffd166),
};

function box(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// A round button with an emoji and a word, drawn on a canvas.
function badgeTexture(icon, label) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = '#9b5de5';
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `110px ${FONT}`;
  g.fillText(icon, 128, 108);
  g.font = `700 40px ${FONT}`;
  g.fillStyle = '#3c096c';
  g.fillText(label, 128, 202);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// A little dress on a hanger, for the inside of the wardrobe.
function hanger(color) {
  const group = new THREE.Group();
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12, Math.PI * 1.4), paint.gold);
  hook.position.y = 0.03;
  const dress = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 16, 1, true), toon(color, { side: THREE.DoubleSide }));
  dress.position.y = -0.17;
  dress.scale.z = 0.45;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.1, 12), toon(color));
  top.position.y = -0.02;
  top.scale.z = 0.5;
  group.add(hook, dress, top);
  return group;
}

// One open door. `side` is -1 for the left door and 1 for the right one.
function door(side) {
  const group = new THREE.Group();
  const height = BODY.height - 0.04;
  group.position.set(side * (BODY.width / 2), BODY.feet + 0.02, FRONT);
  group.rotation.y = side * DOOR.open;
  const x = -side * (DOOR.width / 2);
  group.add(box(DOOR.width, height, DOOR.thickness, paint.body, x, height / 2, 0));
  // Raised panels outside, a gold knob, and a pale board inside to show things on.
  for (const y of [height * 0.3, height * 0.72]) group.add(box(DOOR.width * 0.7, height * 0.32, 0.015, paint.trim, x, y, DOOR.thickness / 2 + 0.006));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), paint.gold);
  knob.position.set(x * 1.8, height * 0.5, DOOR.thickness / 2 + 0.03);
  group.add(knob, box(FACE.width, FACE.height, 0.01, paint.face, x, height / 2, -DOOR.thickness / 2 - 0.004));

  const face = new THREE.Group();
  face.position.set(x, height / 2, -DOOR.thickness / 2 - 0.01);
  face.rotation.y = Math.PI;
  group.add(face);
  group.userData.face = face;
  return group;
}

// The big wardrobe against the back wall, with its doors wide open and a crest on top
// that holds the buttons for what the doors show.
export class Wardrobe extends THREE.Group {
  constructor(shelves) {
    super();
    const { width, height, depth, feet } = BODY;
    const middle = ROOM.back + 0.02 + depth / 2;
    const top = feet + height;
    const wall = 0.04;
    this.add(
      box(width, wall, depth, paint.body, 0, feet + wall / 2, middle),
      box(width + 0.08, wall * 1.5, depth + 0.06, paint.trim, 0, top + wall * 0.75, middle),
      box(wall, height, depth, paint.body, -width / 2 + wall / 2, feet + height / 2, middle),
      box(wall, height, depth, paint.body, width / 2 - wall / 2, feet + height / 2, middle),
      box(width, height, wall, paint.inside, 0, feet + height / 2, ROOM.back + 0.02 + wall / 2),
      box(width - wall * 2, 0.32, depth - wall, paint.trim, 0, feet + 0.2, middle + wall / 2),
    );
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), paint.gold);
      foot.position.set(side * (width / 2 - 0.1), feet - 0.01, FRONT - 0.08);
      const drawer = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), paint.gold);
      drawer.position.set(side * 0.4, feet + 0.2, FRONT + 0.01);
      this.add(foot, drawer);
    }

    // A rail with dresses inside.
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, width - 0.1, 10), paint.gold);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, top - 0.22, middle);
    this.add(rail);
    [0xff9fcf, 0x8fd3ff, 0xffd166, 0xc7a6ff, 0x9be3c3].forEach((color, i) => {
      const dress = hanger(color);
      dress.position.set(-0.6 + i * 0.3, top - 0.24, middle);
      dress.rotation.y = 0.5 + (i % 2) * 0.3;
      this.add(dress);
    });

    // The crest: an arch with a heart on top and the buttons in front.
    const crest = new THREE.Shape();
    crest.moveTo(-width / 2, 0);
    crest.lineTo(width / 2, 0);
    crest.lineTo(width / 2, 0.12);
    crest.quadraticCurveTo(width / 4, 0.12, 0, 0.36);
    crest.quadraticCurveTo(-width / 4, 0.12, -width / 2, 0.12);
    crest.closePath();
    const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(crest, { depth: 0.05, bevelEnabled: false }), paint.trim);
    arch.position.set(0, top + wall * 1.5, FRONT - 0.04);
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), toon(0xf15bb5));
    heart.position.set(0, top + 0.44, FRONT);
    this.add(arch, heart);

    this.tabs = {};
    shelves.forEach(({ id, icon, label }, i) => {
      const badge = new THREE.Mesh(
        new THREE.CircleGeometry(0.115, 40),
        new THREE.MeshBasicMaterial({ map: badgeTexture(icon, label), transparent: true }),
      );
      badge.position.set((i - (shelves.length - 1) / 2) * 0.42, top + 0.16, FRONT + 0.03);
      badge.userData.base = badge.position.clone();
      this.tabs[id] = badge;
      this.add(badge);
    });

    this.doors = [-1, 1].map((side) => door(side));
    this.add(...this.doors);
    // Where things are put: the faces of the left and the right door.
    this.faces = this.doors.map((entry) => entry.userData.face);
  }
}

// A thin shelf sticking out of a door face, at height `y`.
export function shelfBoard(width, y) {
  const mesh = box(width, 0.025, 0.2, paint.trim, 0, y - 0.0125, 0.1);
  return mesh;
}
