import * as THREE from 'three';
import { FONT } from '../ui/board.js';
import { heartShape, starShape, puffy } from './shapes.js';
import { ease, Spring } from './motion.js';

export const BALLOON_COLORS = [0x9b5de5, 0xf15bb5, 0xc77dff, 0x7b2cbf, 0xff8fab, 0x5e60ce, 0x4cc9f0, 0xff9f1c];
// All balloons of one question share a shape, so none stands out.
export const BALLOON_SHAPES = ['round', 'round', 'cat', 'cat', 'heart', 'star'];

const RADIUS = 0.17;
const round = new THREE.SphereGeometry(RADIUS, 32, 24).scale(1, 1.15, 1);
// bottom: where the knot sits. front: how far the number floats from the centre.
const SHAPES = {
  round: { geometry: round, bottom: -RADIUS * 1.15, front: RADIUS * 1.2, label: 0.27 },
  cat: { geometry: round, bottom: -RADIUS * 1.15, front: RADIUS * 1.2, label: 0.27, ears: true },
  heart: { geometry: puffy(heartShape(0.13), 0.03, 0.065), bottom: -0.15, front: 0.115, label: 0.25 },
  star: { geometry: puffy(starShape(0.13, 0.075), 0.03, 0.05), bottom: -0.125, front: 0.1, label: 0.21 },
};
const earGeo = new THREE.ConeGeometry(0.08, 0.14, 16);
const knotGeo = new THREE.ConeGeometry(0.025, 0.04, 12);
const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.4, 4);
const stringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
// The part you can hit is a bit bigger than the balloon, so aiming is forgiving.
const hitGeo = new THREE.SphereGeometry(RADIUS * 1.3, 12, 8);
const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

const toCamera = new THREE.Vector3();

function labelTexture(text) {
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

    this.material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.22,
      emissive: color,
      emissiveIntensity: 0.12,
    });
    // The visible balloon wobbles; the number and hit area stay steady.
    this.form = new THREE.Group();
    this.form.add(new THREE.Mesh(form.geometry, this.material));
    if (form.ears) {
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, this.material);
        ear.position.set(side * 0.105, 0.185, 0);
        ear.rotation.z = -side * 0.42;
        ear.scale.z = 0.7;
        this.form.add(ear);
      }
    }
    const knot = new THREE.Mesh(knotGeo, this.material);
    knot.position.y = form.bottom - 0.012;
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.position.y = knot.position.y - 0.22;
    this.form.add(knot, string);

    this.hit = new THREE.Mesh(hitGeo, hitMat);
    this.hit.userData.owner = this;

    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(String(value)), transparent: true }));
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
