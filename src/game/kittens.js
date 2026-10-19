import * as THREE from 'three';
import { drawCatHead } from '../wardrobe/creatures/cat.js';
import { EXPRESSIONS, MID, hex, ellipse } from '../wardrobe/creatures/drawing.js';
import { PALETTES } from '../wardrobe/catalog.js';
import { paintOf } from '../wardrobe/look.js';
import { Spring } from './motion.js';
import { SEE_THROUGH } from '../ui/board.js';

// The kittens the player rescues from the cloud troll's bubbles. They are flat, sticker-like
// pictures (cheap enough to have many in a headset) drawn with the same head as the pet cat.

const FURS = Object.keys(PALETTES.catFur);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// A bubble kitten: any fur, with the eyes that go with it (few looks, so few textures).
export const kittenLook = (fur = pick(FURS)) => ({ creature: 'cat', paint: { fur }, wear: {} });

// Drawn in a 512 × 620 space: tail, body, paws, then the head on top.
const WIDTH = 512;
const HEIGHT = 620;
const HEAD = 0.72;

function drawKitten(g, colors, face) {
  const fur = hex(colors.fur);
  const dark = hex(colors.dark);
  const light = hex(colors.light);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // A tail curling up on the right.
  const tail = () => {
    g.beginPath();
    g.moveTo(370, 520);
    g.bezierCurveTo(480, 520, 500, 420, 452, 352);
  };
  tail();
  g.strokeStyle = dark;
  g.lineWidth = 62;
  g.stroke();
  tail();
  g.strokeStyle = fur;
  g.lineWidth = 36;
  g.stroke();

  ellipse(g, MID, 478, 150, 118);
  g.fillStyle = fur;
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = dark;
  g.stroke();
  ellipse(g, MID, 500, 82, 76);
  g.fillStyle = light;
  g.fill();

  for (const side of [-1, 1]) {
    ellipse(g, MID + side * 62, 580, 46, 30);
    g.fillStyle = colors.paws == null ? light : hex(colors.paws);
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = dark;
    g.stroke();
  }

  g.save();
  g.translate(MID * (1 - HEAD), 0);
  g.scale(HEAD, HEAD);
  drawCatHead(g, colors, face);
  g.restore();
}

// One texture per look and face, drawn the first time it is needed and shared by all kittens.
const textures = new Map();

function kittenTexture(look, face) {
  const key = `${JSON.stringify(look.paint)}/${face}`;
  if (!textures.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = Math.round((256 * HEIGHT) / WIDTH);
    const g = canvas.getContext('2d');
    g.scale(256 / WIDTH, 256 / WIDTH);
    drawKitten(g, paintOf(look), EXPRESSIONS[face]);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, texture);
  }
  return textures.get(key);
}

// A picture of a whole kitten for the menus, as an image URL.
const pictures = new Map();
export function kittenPicture(look, face = 'happy') {
  const key = `${JSON.stringify(look.paint)}/${face}`;
  if (!pictures.has(key)) pictures.set(key, kittenTexture(look, face).image.toDataURL());
  return pictures.get(key);
}

// A kitten standing on y = 0 that always faces the camera. It cannot talk (it is a kitten):
// it shows how it feels with its face and by hopping.
export class Kitten extends THREE.Group {
  constructor(look = kittenLook(), height = 0.2) {
    super();
    this.look = look;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: kittenTexture(look, 'open'), transparent: true, alphaTest: SEE_THROUGH }));
    this.sprite.center.set(0.5, 0);
    // Kept so squashing can scale around the resting size.
    this.size = { width: (height * WIDTH) / HEIGHT, height };
    this.sprite.scale.set(this.size.width, height, 1);
    this.add(this.sprite);
    this.face = 'open';
    this.faceTimer = 0;
    this.hopTime = 1;
    this.hopHeight = 0;
    this.squash = new Spring(1, 380, 12);
    this.phase = Math.random() * 10;
    this.blinkIn = 1 + Math.random() * 3;
  }

  // A face for a while, then back to the resting face.
  setFace(name, seconds = 0) {
    this.face = name;
    this.faceTimer = seconds;
    this.sprite.material.map = kittenTexture(this.look, name);
  }

  hop(height = 0.08, face = 'happy') {
    this.hopTime = 0;
    this.hopHeight = height;
    this.squash.value = 0.75;
    this.setFace(face, 1);
  }

  update(dt, t) {
    if (this.faceTimer > 0) {
      this.faceTimer -= dt;
      if (this.faceTimer <= 0) this.setFace('open');
    } else if ((this.blinkIn -= dt) <= 0) {
      this.blinkIn = 2 + Math.random() * 3;
      this.setFace('blink', 0.13);
    }
    this.hopTime = Math.min(1, this.hopTime + dt * 2.2);
    const lift = Math.sin(this.hopTime * Math.PI) * this.hopHeight;
    const breathe = 1 + Math.sin(t * 3 + this.phase) * 0.02;
    const squash = this.squash.update(dt);
    this.sprite.position.y = lift;
    this.sprite.scale.y = this.size.height * squash * breathe;
    this.sprite.scale.x = this.size.width * (2 - squash);
  }
}

