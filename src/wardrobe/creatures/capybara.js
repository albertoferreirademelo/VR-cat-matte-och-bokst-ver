import * as THREE from 'three';
import { Creature } from './creature.js';
import { MID, INK, hex, ellipse, mouth, drawEyes, drawBlush, drawWorry, expressionTextures, pictureURL } from './drawing.js';

const HEAD_Y = 0.1; // head centre above the neck
const HEAD = [0.132, 0.116, 0.12]; // half width, height and depth of the head
const SNOUT = [0.064, 0.072, 0.056];
const SNOUT_AT = [0, HEAD_Y - 0.024, 0.08];
const EYES = { x: 168, y: 202, scale: 0.78, dots: true };

// The snout is a darker patch of the fur, unless its nose is painted.
const snoutColor = (colors) =>
  colors.nose == null ? new THREE.Color(colors.fur).lerp(new THREE.Color(colors.dark), 0.5) : new THREE.Color(colors.nose);

// Button eyes set wide apart and pink cheeks; the snout between them is its own picture.
function drawFace(g, face, colors) {
  drawBlush(g, face, { x: 168, y: 270, scale: 1.05 });
  drawEyes(g, face, colors.iris, EYES);
  if (face.worried) drawWorry(g, EYES);
}

// Two small nostrils and a little mouth.
function drawSnout(g, face) {
  g.fillStyle = INK;
  for (const side of [-1, 1]) {
    g.save();
    g.translate(MID + side * 34, 196);
    g.rotate(side * 0.35);
    ellipse(g, 0, 0, 9, 15);
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(MID, 270);
  g.scale(1.5, 1.5);
  g.translate(-MID, -270);
  mouth(g, face.mouth, 270);
  g.restore();
}

// A flat picture of the capybara's head for the menus.
export function capybaraPicture(colors, face) {
  return pictureURL((g) => {
    g.lineWidth = 14;
    g.strokeStyle = hex(colors.dark);
    for (const side of [-1, 1]) {
      ellipse(g, MID + side * 150, 118, 46, 42);
      g.fillStyle = hex(colors.fur);
      g.fill();
      g.stroke();
      ellipse(g, MID + side * 150, 124, 24, 22);
      g.fillStyle = hex(colors.dark);
      g.fill();
    }
    ellipse(g, MID, 290, 226, 196);
    g.fillStyle = hex(colors.fur);
    g.fill();
    g.stroke();
    drawBlush(g, face, { x: 150, y: 352, scale: 1.3 });
    drawEyes(g, face, colors.iris, { ...EYES, x: 120, y: 268, scale: 0.85 });
    ellipse(g, MID, 330, 92, 96);
    g.fillStyle = `#${snoutColor(colors).getHexString()}`;
    g.fill();
    g.translate(MID, 330);
    g.scale(0.62, 0.62);
    g.translate(-MID, -236);
    drawSnout(g, face);
  });
}

// A round, soft capybara: head and body in one, button eyes, tiny ears and no tail.
export class Capybara extends Creature {
  constructor() {
    super();
    const { fur, dark, paws, nose } = this.materials;
    const model = this.model;
    this.earTilt = 0.55;
    this.earDroop = 0.6;
    this.headHeight = 0.33;

    for (const side of [-1, 1]) {
      const foot = new THREE.Group();
      foot.position.set(side * 0.062, 0, 0.02);
      this.ball(foot, paws, 0.04, 0, 0.028, 0.02, [1, 0.7, 1.25]);
      model.add(foot);
    }
    this.ball(model, fur, 0.14, 0, 0.155, 0, [1, 1.04, 0.95]);

    this.arms = [1, -1].map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.114, 0.19, 0.03);
      this.limb(arm, fur, 0.03, 0.03, -0.03);
      this.ball(arm, paws, 0.031, 0, -0.058, 0);
      model.add(arm);
      return arm;
    });

    this.head = new THREE.Group();
    this.head.position.y = 0.232;
    this.head.rotation.order = 'YXZ';
    model.add(this.head);
    this.ball(this.head, fur, 0.12, 0, HEAD_Y, 0, HEAD.map((size) => size / 0.12));
    const face = this.decal(this.head, 'face');
    face.position.y = HEAD_Y;
    face.scale.set(...HEAD.map((size) => size * 1.005));

    this.ball(this.head, nose, 0.062, ...SNOUT_AT, SNOUT.map((size) => size / 0.062), false);
    const snout = this.decal(this.head, 'snout');
    snout.position.set(...SNOUT_AT);
    snout.scale.set(...SNOUT.map((size) => size * 1.01));

    this.ears = [1, -1].map((side) => {
      const ear = new THREE.Group();
      ear.position.set(side * 0.088, HEAD_Y + 0.082, -0.03);
      ear.userData.side = side;
      this.ball(ear, fur, 0.032, 0, 0.016, 0, [1, 0.9, 0.55]);
      this.ball(ear, dark, 0.019, 0, 0.015, 0.012, [1, 0.85, 0.4], false);
      this.head.add(ear);
      return ear;
    });

    // The head is wider and flatter than the cat's, with the eyes further apart.
    this.anchor('head', [0, HEAD_Y - 0.016, 0], [0.98, 0.95, 0.95]);
    this.anchor('face', [0, HEAD_Y + 0.02, -0.012], [1.15, 0.9, 0.95]);
    this.anchor('ear', [0.012, HEAD_Y - 0.03, -0.02]);
  }

  ownColors(colors) {
    return { paws: colors.dark, nose: snoutColor(colors).getHex() };
  }

  drawDecals(colors) {
    return {
      face: expressionTextures((g, face) => drawFace(g, face, colors)),
      snout: expressionTextures((g, face) => drawSnout(g, face), 256),
    };
  }
}
