import * as THREE from 'three';
import { balloonForm, labelTexture } from './balloon.js';
import { Kitten } from './kittens.js';
import { toon } from './toon.js';
import { ease, Spring } from './motion.js';

// The things to shoot in the adventure, each carrying an answer:
//   a soap bubble with a trapped kitten inside, blown out by the cloud troll, and
//   a storm ball the troll throws in the boss fight.
// The adventure moves `anchor`; the orb wobbles around it on its own little loop.

const hitGeo = new THREE.SphereGeometry(0.28, 12, 8);
const hitMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const puffGeo = new THREE.SphereGeometry(1, 16, 12);
const eyeGeo = new THREE.SphereGeometry(0.022, 10, 8);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2b1b3d });
const STORM = [
  [0, 0, 0, 0.15],
  [-0.1, 0.04, 0.02, 0.1],
  [0.1, 0.05, 0.01, 0.11],
  [0.02, 0.11, 0, 0.1],
  [-0.06, -0.08, 0.03, 0.09],
  [0.08, -0.07, 0.02, 0.09],
];
const toCamera = new THREE.Vector3();
const offset = new THREE.Vector3();

function stormForm() {
  const material = toon(0x7a68b8, { emissive: 0x3c2a7a, emissiveIntensity: 0.25 });
  const group = new THREE.Group();
  for (const [x, y, z, r] of STORM) {
    const puff = new THREE.Mesh(puffGeo, material);
    puff.position.set(x, y, z);
    puff.scale.setScalar(r);
    group.add(puff);
  }
  // Two grumpy little eyes on top, like the troll's.
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.05, 0.13, 0.08);
    group.add(eye);
  }
  group.userData.material = material;
  return group;
}

export class Orb extends THREE.Group {
  // kind: 'bubble' (with `look`, the kitten inside) or 'storm'. `value` null shows no number.
  constructor(kind, value, { color = 0xc77dff, look, golden = false, delay = 0 } = {}) {
    super();
    this.kind = kind;
    this.value = value;
    this.mode = 'float'; // float | goal | fly | bump | gone
    this.anchor = new THREE.Vector3();
    this.goal = null;
    this.hovered = false;
    this.done = false;
    this.age = -delay;
    this.phase = Math.random() * Math.PI * 2;
    this.wobble = 0.1; // how far it loops around its anchor
    this.size = new Spring(1);
    this.bumpTime = 0;
    this.fading = false;

    if (kind === 'bubble') {
      this.form = balloonForm('bubble', golden ? 0xffc93c : color);
      this.form.scale.setScalar(golden ? 1.9 : 1.45);
      if (golden) {
        const skin = this.form.userData.material;
        skin.color.set(0xffd166);
        skin.opacity = 0.6;
        skin.emissiveIntensity = 0.55;
      }
      // The kitten is drawn over the bubble's skin, so it stays bright and easy to see.
      this.kitten = new Kitten(look, golden ? 0.36 : 0.27);
      this.kitten.position.y = golden ? -0.17 : -0.125;
      this.kitten.sprite.renderOrder = 2;
      this.add(this.kitten);
    } else {
      this.form = stormForm();
    }
    this.material = this.form.userData.material;
    this.add(this.form);

    this.hit = new THREE.Mesh(hitGeo, hitMat);
    this.hit.userData.owner = this;
    if (golden) this.hit.scale.setScalar(1.5);
    this.add(this.hit);

    if (value != null) {
      this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(String(value)), transparent: true, depthTest: false }));
      this.label.scale.setScalar(0.27);
      this.label.renderOrder = 3;
      this.add(this.label);
    }
    this.scale.setScalar(0.0001);
  }

  // Where the orb is on its loop around the anchor right now.
  loop(target) {
    const a = this.age + this.phase;
    return target
      .copy(this.anchor)
      .add(offset.set(Math.sin(a * 1.1) * this.wobble, Math.sin(a * 1.7) * this.wobble * 0.7, 0));
  }

  // A wrong answer: it shakes its head and keeps its kitten.
  bump() {
    this.mode = 'bump';
    this.bumpTime = 0;
    this.size.value = 0.7;
  }

  // Flies along `path(p)` (p from 0 to 1) in `seconds`, then calls `done`.
  fly(path, seconds, done) {
    this.mode = 'fly';
    this.path = path;
    this.flight = { time: 0, seconds, done };
  }

  update(dt, cameraPosition) {
    this.age += dt;
    if (this.age < 0) return;

    // `fading`: shrinking away while it flies back to the troll.
    this.size.target = this.fading ? 0 : this.hovered && this.mode === 'float' ? 1.15 : 1;
    if (this.mode === 'float') {
      this.loop(this.position);
    } else if (this.mode === 'bump') {
      this.bumpTime += dt;
      this.loop(this.position);
      this.position.x += Math.sin(this.bumpTime * 40) * 0.03 * Math.max(0, 1 - this.bumpTime * 2);
      this.material.emissiveIntensity = 0.05;
    } else if (this.mode === 'goal') {
      this.size.target = 1.3 + Math.sin(this.age * 9) * 0.07;
      this.material.emissiveIntensity = 0.7;
      this.position.lerp(this.goal, Math.min(1, dt * 3.5));
    } else if (this.mode === 'fly') {
      const flight = this.flight;
      flight.time += dt;
      const p = Math.min(1, flight.time / flight.seconds);
      this.position.copy(this.path(p));
      if (p >= 1) {
        this.mode = 'gone';
        flight.done?.();
      }
    }
    if (this.mode === 'gone') this.done = true;

    const grow = ease.outBack(Math.min(1, this.age / 0.4));
    this.scale.setScalar(Math.max(0.0001, grow * this.size.update(dt)));
    this.form.rotation.z = Math.sin(this.age * 1.6 + this.phase) * 0.1;
    if (this.kind === 'storm') this.form.rotation.y = Math.sin(this.age * 2 + this.phase) * 0.4;
    this.kitten?.update(dt, this.age);

    // The number floats on the side facing the player, a little low so the kitten's face shows.
    if (this.label) {
      toCamera.copy(cameraPosition).sub(this.position).normalize();
      this.label.position.copy(toCamera).multiplyScalar(0.24);
      if (this.kitten) this.label.position.y -= 0.075;
    }
  }

  dispose() {
    this.material.dispose();
    if (this.label) {
      this.label.material.map.dispose();
      this.label.material.dispose();
    }
  }
}
