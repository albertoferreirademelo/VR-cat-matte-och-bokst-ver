import * as THREE from 'three';
import { FONT, SEE_THROUGH } from '../ui/board.js';
import { heartShape, starShape, puffy } from './shapes.js';
import { ease, Spring } from './motion.js';

export const BALLOON_COLORS = [0x9b5de5, 0xf15bb5, 0xc77dff, 0x7b2cbf, 0xff8fab, 0x5e60ce, 0x4cc9f0, 0xff9f1c];
// All balloons of one question share a shape, so none stands out. A player who picked a
// balloon style (see src/wardrobe/gear.js) gets that shape; 'mix' takes turns with these.
export const BALLOON_SHAPES = ['round', 'round', 'cat', 'cat', 'heart', 'star'];
export const shapeFor = (style) => (SHAPES[style] ? style : BALLOON_SHAPES[Math.floor(Math.random() * BALLOON_SHAPES.length)]);

const RADIUS = 0.17;
const round = new THREE.SphereGeometry(RADIUS, 32, 24).scale(1, 1.15, 1);
const fishBody = new THREE.SphereGeometry(RADIUS, 32, 24).scale(1.25, 0.95, 0.75);
// bottom: where the knot sits. front: how far the number floats from the centre.
const SHAPES = {
  round: { geometry: round, bottom: -RADIUS * 1.15, front: RADIUS * 1.2, label: 0.27 },
  cat: { geometry: round, bottom: -RADIUS * 1.15, front: RADIUS * 1.2, label: 0.27, ears: true },
  heart: { geometry: puffy(heartShape(0.13), 0.03, 0.065), bottom: -0.15, front: 0.115, label: 0.25 },
  star: { geometry: puffy(starShape(0.13, 0.075), 0.03, 0.05), bottom: -0.125, front: 0.1, label: 0.21 },
  capybara: { geometry: round, bottom: -RADIUS * 1.15, front: RADIUS * 1.2, label: 0.27, roundEars: true },
  fish: { geometry: fishBody, bottom: -RADIUS * 0.95, front: RADIUS * 1.0, label: 0.25, fish: true },
  // A soap bubble: see-through and shiny, floating free without a string.
  bubble: { geometry: new THREE.SphereGeometry(RADIUS * 1.05, 32, 24), bottom: -RADIUS, front: RADIUS * 1.15, label: 0.27, bubble: true },
};
const earGeo = new THREE.ConeGeometry(0.08, 0.14, 16);
const roundEarGeo = new THREE.SphereGeometry(0.05, 14, 10);
const tailGeo = new THREE.ConeGeometry(0.1, 0.13, 3);
const finGeo = new THREE.ConeGeometry(0.05, 0.09, 3);
const shineGeo = new THREE.SphereGeometry(0.035, 12, 8);
const fishEyeGeo = new THREE.SphereGeometry(0.022, 12, 8);
const fishEyeMat = new THREE.MeshBasicMaterial({ color: 0x2b1b3d });
const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
const knotGeo = new THREE.ConeGeometry(0.025, 0.04, 12);
const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.4, 4);
const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
// The part you can hit is a bit bigger than the balloon, so aiming is forgiving.
const hitGeo = new THREE.SphereGeometry(RADIUS * 1.3, 12, 8);
const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

const toCamera = new THREE.Vector3();

export function labelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  let size = 170;
  g.font = `700 ${size}px ${FONT}`;
  const fit = 210 / g.measureText(text).width;
  if (fit < 1) {
    size *= fit;
    g.font = `700 ${size}px ${FONT}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.14;
  g.strokeStyle = '#2b1b3d';
  g.strokeText(text, 128, 136);
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The balloon itself, without its number: one shape in one colour, with knot and string.
// `userData.material` is shared by all its parts.
export function balloonForm(shape, color) {
  const form = SHAPES[shape] ?? SHAPES.round;
  const material = form.bubble
    ? new THREE.MeshStandardMaterial({
        color: 0xdff6ff,
        roughness: 0.05,
        transparent: true,
        opacity: 0.4,
        emissive: color,
        emissiveIntensity: 0.35,
        depthWrite: false,
      })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.22, emissive: color, emissiveIntensity: 0.12 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(form.geometry, material));
  if (form.ears) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, material);
      ear.position.set(side * 0.105, 0.185, 0);
      ear.rotation.z = -side * 0.42;
      ear.scale.z = 0.7;
      group.add(ear);
    }
  }
  if (form.roundEars) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(roundEarGeo, material);
      ear.position.set(side * 0.1, 0.17, -0.01);
      ear.scale.z = 0.6;
      group.add(ear);
    }
  }
  if (form.fish) {
    const tail = new THREE.Mesh(tailGeo, material);
    tail.position.x = -0.25;
    tail.rotation.z = Math.PI / 2;
    tail.scale.z = 0.35;
    const fin = new THREE.Mesh(finGeo, material);
    fin.position.set(0.02, 0.16, 0);
    fin.scale.z = 0.3;
    group.add(tail, fin);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(fishEyeGeo, fishEyeMat);
      eye.position.set(0.15, 0.04, side * 0.095);
      group.add(eye);
    }
  }
  if (form.bubble) {
    const shine = new THREE.Mesh(shineGeo, shineMat);
    shine.position.set(-0.07, 0.08, 0.14);
    group.add(shine);
  } else {
    const knot = new THREE.Mesh(knotGeo, material);
    knot.position.y = form.bottom - 0.012;
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.y = knot.position.y - 0.22;
    group.add(knot, string);
  }
  group.userData.material = material;
  return group;
}

export class Balloon extends THREE.Group {
  constructor(value, color, shape = 'round', delay = 0) {
    super();
    const form = SHAPES[shape];
    this.value = value;
    this.color = color;
    this.mode = 'fall'; // fall | away | deflate | glow
    this.hovered = false;
    this.done = false;
    this.base = new THREE.Vector3();
    this.goal = null;
    this.lift = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.age = -delay;
    this.speed = 0;
    this.size = new Spring(1);
    this.front = form.front;

    // The visible balloon wobbles; the number and hit area stay steady.
    this.form = balloonForm(shape, color);
    this.material = this.form.userData.material;

    this.hit = new THREE.Mesh(hitGeo, hitMat);
    this.hit.userData.owner = this;

    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(String(value)), transparent: true, alphaTest: SEE_THROUGH }));
    this.label.scale.setScalar(form.label);

    this.add(this.form, this.hit, this.label);
    this.scale.setScalar(0.0001);
  }

  // Sets where the balloon falls and turns flat shapes toward the player.
  place(x, z) {
    this.base.set(x, 0, z);
    this.form.rotation.y = Math.atan2(-x, -z);
  }

  setHeight(y) {
    const sway = Math.sin(this.age * 1.3 + this.phase) * 0.04;
    this.position.set(this.base.x + sway, y + this.lift, this.base.z);
  }

  update(dt, cameraPosition) {
    this.age += dt;
    if (this.age < 0) return;

    this.size.target = this.hovered && this.mode === 'fall' ? 1.16 : 1;
    if (this.mode === 'away') {
      this.speed += 3 * dt;
      this.position.y += this.speed * dt;
      if (this.position.y > 4.5) this.done = true;
    } else if (this.mode === 'deflate') {
      this.size.target = 0;
      this.position.y -= 0.3 * dt;
      if (this.size.value < 0.06) this.done = true;
    } else if (this.mode === 'glow') {
      this.size.target = 1.3 + Math.sin(this.age * 9) * 0.08;
      this.material.emissiveIntensity = 0.6;
      if (this.goal) this.position.lerp(this.goal, Math.min(1, dt * 3.5));
    }
    const grow = ease.outBack(Math.min(1, this.age / 0.45));
    this.scale.setScalar(Math.max(0.0001, grow * this.size.update(dt)));
    this.form.rotation.z = Math.sin(this.age * 1.6 + this.phase) * 0.07;

    // Keep the number on the side of the balloon that faces the player.
    toCamera.copy(cameraPosition).sub(this.position).normalize();
    this.label.position.copy(toCamera).multiplyScalar(this.front);
  }

  dispose() {
    this.material.dispose();
    this.label.material.map.dispose();
    this.label.material.dispose();
  }
}
