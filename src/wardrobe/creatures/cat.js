import * as THREE from 'three';
import { toon, addOutline } from '../../game/toon.js';
import { Creature } from './creature.js';
import {
  MID,
  hex,
  ellipse,
  mouth,
  drawEyes,
  drawBlush,
  drawWorry,
  expressionTextures,
  pictureURL,
} from './drawing.js';

const HEAD_Y = 0.105; // head centre above the neck
const EYES = { x: 92, y: 262 };

function drawFace(g, face, colors, { nose = false } = {}) {
  // Tabby stripes on the forehead.
  g.strokeStyle = hex(colors.dark);
  g.lineWidth = 17;
  for (const [x1, x2] of [
    [MID, MID],
    [MID - 50, MID - 38],
    [MID + 50, MID + 38],
  ]) {
    g.beginPath();
    g.moveTo(x1, 64);
    g.lineTo(x2, x1 === MID ? 128 : 116);
    g.stroke();
  }

  drawBlush(g, face, { x: 140, y: 336 });

  // Whiskers.
  g.strokeStyle = 'rgba(43, 27, 61, 0.55)';
  g.lineWidth = 5;
  for (const side of [-1, 1]) {
    for (const [dy1, dy2] of [
      [-6, -22],
      [14, 20],
    ]) {
      g.beginPath();
      g.moveTo(MID + side * 182, 322 + dy1);
      g.lineTo(MID + side * 246, 322 + dy2);
      g.stroke();
    }
  }

  drawEyes(g, face, colors.iris, EYES);
  if (face.worried) drawWorry(g, EYES);

  if (nose) {
    ellipse(g, MID, 312, 15, 11);
    g.fillStyle = colors.nose == null ? '#ff7fae' : hex(colors.nose);
    g.fill();
  }
  mouth(g, face.mouth);
}

// A flat picture of the cat's head for the menus.
export function catPicture(colors, face) {
  return pictureURL((g) => drawCatHead(g, colors, face));
}

// The cat's head as in its menu picture, in the 512 square (also used for the kittens).
export function drawCatHead(g, colors, face) {
  g.lineWidth = 14;
  g.strokeStyle = hex(colors.dark);
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(MID + side * 190, 230);
    g.lineTo(MID + side * 168, 36);
    g.lineTo(MID + side * 40, 130);
    g.closePath();
    g.fillStyle = hex(colors.fur);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(MID + side * 164, 180);
    g.lineTo(MID + side * 152, 84);
    g.lineTo(MID + side * 88, 134);
    g.closePath();
    g.fillStyle = '#ff9ecb';
    g.fill();
  }
  ellipse(g, MID, 296, 216, 186);
  g.fillStyle = hex(colors.fur);
  g.fill();
  g.stroke();
  g.translate(MID, 300);
  g.scale(0.76, 0.76);
  g.translate(-MID, -276);
  drawFace(g, face, colors, { nose: true });
}

// A cartoon kitten with a collar and bell, fluffy cheeks and a long tail.
export class Cat extends Creature {
  constructor() {
    super();
    const { fur, light, dark, paws, nose, ink } = this.materials;
    const pink = toon(0xff9ecb);
    const model = this.model;

    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.046, 0, 0);
      this.limb(leg, fur, 0.036, 0.03, 0.052);
      this.ball(leg, paws, 0.042, 0, 0.024, 0.024, [1, 0.6, 1.3]);
      model.add(leg);
    }
    this.ball(model, fur, 0.1, 0, 0.165, 0, [1, 1.15, 0.92]);
    this.ball(model, light, 0.07, 0, 0.152, 0.036, [1, 1.15, 0.8], false);

    const band = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.012, 8, 24), toon(0xff4f9a));
    band.position.y = 0.264;
    band.rotation.x = Math.PI / 2;
    model.add(band);
    this.ball(model, toon(0xffd166), 0.017, 0, 0.246, 0.072);

    this.arms = [1, -1].map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.09, 0.236, 0);
      this.limb(arm, fur, 0.027, 0.065, -0.05);
      this.ball(arm, paws, 0.031, 0, -0.098, 0);
      model.add(arm);
      return arm;
    });

    // The tail is a chain of segments, so a wave can travel along it.
    let parent = model;
    for (let i = 0; i < 5; i++) {
      const segment = new THREE.Group();
      if (i === 0) segment.position.set(0, 0.085, -0.075);
      else segment.position.y = 0.05;
      this.limb(segment, i === 4 ? light : i % 2 ? dark : fur, 0.022 - i * 0.0015, 0.03, 0.025);
      parent.add(segment);
      this.tail.push(segment);
      parent = segment;
    }

    this.head = new THREE.Group();
    this.head.position.y = 0.275;
    this.head.rotation.order = 'YXZ';
    model.add(this.head);
    this.ball(this.head, fur, 0.13, 0, HEAD_Y, 0, [1.12, 1, 1]);

    const face = this.decal(this.head, 'face');
    face.position.y = HEAD_Y;
    face.scale.set(0.1306 * 1.12, 0.1306, 0.1306);
    this.ball(this.head, nose, 0.014, 0, HEAD_Y - 0.027, 0.129, [1.2, 0.85, 1], false);

    const earShape = new THREE.ConeGeometry(0.058, 0.115, 20);
    this.ears = [1, -1].map((side) => {
      const ear = new THREE.Group();
      ear.position.set(side * 0.08, HEAD_Y + 0.09, 0);
      ear.userData.side = side;
      const outer = new THREE.Mesh(earShape, fur);
      outer.position.y = 0.045;
      outer.scale.z = 0.6;
      addOutline(outer, ink, 0.058);
      const inner = new THREE.Mesh(earShape, pink);
      inner.position.set(0, 0.04, 0.014);
      inner.scale.set(0.6, 0.7, 0.4);
      ear.add(outer, inner);
      this.head.add(ear);
      return ear;
    });

    // Fluffy cheeks.
    const tuft = new THREE.ConeGeometry(0.03, 0.07, 10);
    for (const side of [-1, 1]) {
      for (const [y, tilt, size] of [
        [0.085, 0.25, 1],
        [0.055, 0.6, 0.8],
      ]) {
        const fluff = new THREE.Mesh(tuft, fur);
        fluff.position.set(side * 0.138, y, 0.012);
        fluff.rotation.z = -side * (Math.PI / 2 + tilt);
        fluff.scale.set(size, size, size * 0.7);
        addOutline(fluff, ink, 0.03);
        this.head.add(fluff);
      }
    }

    // The items were made for this head, so they sit at its centre unchanged.
    for (const slot of ['head', 'face', 'ear']) this.anchor(slot, [0, HEAD_Y, 0]);
  }

  ownColors(colors) {
    return { paws: colors.light, nose: 0xff9ecb };
  }

  drawDecals(colors) {
    return { face: expressionTextures((g, face) => drawFace(g, face, colors)) };
  }
}
