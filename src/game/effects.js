import * as THREE from 'three';
import { starShape, heartShape } from './shapes.js';

const PARTY = [0xff8fab, 0xffd166, 0x9b5de5, 0x4cc9f0, 0x80ed99, 0xf15bb5, 0xffffff];
const GOLD = 0xffc93c;

const dummy = new THREE.Object3D();
const tint = new THREE.Color();
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const spread = (amount) => (Math.random() - 0.5) * 2 * amount;

// Many small pieces of one shape, drawn together in a single call.
class Pool {
  constructor(geometry, capacity) {
    this.mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, tint.set(0xffffff));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.capacity = capacity;
    this.parts = [];
  }

  spawn(position, velocity, { color = 0xffffff, life = 0.8, size = 1, gravity = 3, drag = 0, spin = 6, flutter = 0 }) {
    if (this.parts.length >= this.capacity) this.parts.shift();
    this.parts.push({
      position: position.clone(),
      velocity,
      color,
      life,
      size,
      gravity,
      drag,
      spin,
      flutter,
      age: 0,
      phase: Math.random() * 6.3,
      rotation: new THREE.Euler(spread(3), spread(3), spread(3)),
    });
  }

  update(dt) {
    let count = 0;
    for (const part of this.parts) {
      part.age += dt;
      if (part.age >= part.life) continue;
      part.velocity.multiplyScalar(Math.max(0, 1 - part.drag * dt));
      part.velocity.y -= part.gravity * dt;
      part.velocity.x += Math.sin(part.age * 7 + part.phase) * part.flutter * dt;
      part.position.addScaledVector(part.velocity, dt);
      part.rotation.x += part.spin * dt;
      part.rotation.y += part.spin * 0.7 * dt;
      // Pop in quickly, shrink away at the end.
      const scale = part.size * Math.min(1, part.age / 0.06, (1 - part.age / part.life) / 0.3);
      dummy.position.copy(part.position);
      dummy.rotation.copy(part.rotation);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(count, dummy.matrix);
      this.mesh.setColorAt(count, tint.set(part.color));
      count++;
    }
    this.parts = this.parts.filter((part) => part.age < part.life);
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// Confetti, stars, hearts and sparkles: all the cute explosions.
export class Effects extends THREE.Group {
  constructor() {
    super();
    this.confetti = new Pool(new THREE.PlaneGeometry(0.036, 0.02), 500);
    this.stars = new Pool(new THREE.ShapeGeometry(starShape(0.03, 0.014)), 220);
    this.heartPool = new Pool(new THREE.ShapeGeometry(heartShape(0.028)), 60);
    this.sparks = new Pool(new THREE.ShapeGeometry(starShape(0.024, 0.006, 4)), 300);
    this.pools = [this.confetti, this.stars, this.heartPool, this.sparks];
    this.add(...this.pools.map((pool) => pool.mesh));

    const ringGeometry = new THREE.RingGeometry(0.85, 1, 40);
    this.rings = Array.from({ length: 6 }, () => {
      const ring = new THREE.Mesh(
        ringGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.visible = false;
      ring.userData = { age: 0, life: 0.45, size: 0.5 };
      this.add(ring);
      return ring;
    });
    this.rain = 0;
    this.owed = 0;
  }

  ring(position, color, size = 0.5) {
    const ring = this.rings.find((candidate) => !candidate.visible) ?? this.rings[0];
    ring.position.copy(position);
    ring.material.color.set(color);
    ring.userData = { age: 0, life: 0.45, size };
    ring.visible = true;
  }

  burst(pool, position, count, speed, options) {
    for (let i = 0; i < count; i++) {
      const velocity = new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
      pool.spawn(position, velocity, typeof options === 'function' ? options() : options);
    }
  }

  // A balloon pops.
  pop(position, color) {
    this.ring(position, 0xffffff);
    this.burst(this.confetti, position, 22, 1.9, () => ({ color: Math.random() < 0.5 ? color : pick(PARTY), life: 1.1, drag: 1.6, gravity: 2.4 }));
    this.burst(this.stars, position, 9, 1.5, () => ({ color: GOLD, life: 0.9, drag: 1.2, size: 0.8 + Math.random() * 0.6 }));
    this.burst(this.sparks, position, 10, 2.4, { life: 0.5, drag: 2.5, gravity: 0 });
  }

  // A wrong balloon lets its air out.
  puff(position) {
    this.burst(this.sparks, position, 8, 0.7, { color: 0xd9c2ff, life: 0.5, drag: 2, gravity: -0.6 });
  }

  twinkle(position, color = GOLD) {
    this.ring(position, color, 0.14);
    this.burst(this.sparks, position, 8, 0.9, { color, life: 0.45, drag: 3, gravity: 0, size: 0.8 });
  }

  trail(position, color = GOLD) {
    this.sparks.spawn(position, new THREE.Vector3(spread(0.15), spread(0.15), spread(0.15)), {
      color,
      life: 0.4,
      gravity: 0.4,
      size: 0.7,
    });
  }

  // Sparkles along a wand shot, in the wand's colours.
  zap(origin, direction, distance, colors = [0xffffff, GOLD, 0xff8fab]) {
    const point = new THREE.Vector3();
    for (let d = 0.35; d < distance; d += 0.16) {
      point.copy(origin).addScaledVector(direction, d);
      this.sparks.spawn(point, new THREE.Vector3(spread(0.2), spread(0.2), spread(0.2)), {
        color: pick(colors),
        life: 0.25 + d * 0.06,
        gravity: 0,
        size: 0.6,
      });
    }
  }

  hearts(position) {
    for (let i = 0; i < 7; i++) {
      const start = position.clone().add(new THREE.Vector3(spread(0.14), spread(0.05), spread(0.06)));
      this.heartPool.spawn(start, new THREE.Vector3(spread(0.12), 0.25 + Math.random() * 0.2, 0), {
        color: pick([0xff4f9a, 0xff8fab, 0xff6b6b]),
        life: 1.3 + Math.random() * 0.4,
        gravity: -0.15,
        spin: 0,
        flutter: 0.8,
        size: 0.8 + Math.random() * 0.6,
      });
    }
  }

  firework(position, color = pick(PARTY)) {
    this.ring(position, color, 0.9);
    this.burst(this.stars, position, 26, 2.3, () => ({ color: Math.random() < 0.6 ? color : GOLD, life: 1.3, drag: 1.9, gravity: 0.7 }));
    this.burst(this.sparks, position, 26, 3, { life: 0.9, drag: 2.2, gravity: 0.4 });
    this.burst(this.confetti, position, 20, 1.6, () => ({ color: pick(PARTY), life: 1.8, drag: 1.5, gravity: 1.4, flutter: 1 }));
  }

  // Confetti keeps falling over the play area for this many seconds.
  confettiRain(seconds) {
    this.rain = seconds;
  }

  clear() {
    this.rain = 0;
    for (const pool of this.pools) pool.parts = [];
    for (const ring of this.rings) ring.visible = false;
  }

  update(dt, cameraPosition) {
    if (this.rain > 0) {
      this.rain -= dt;
      this.owed += dt * 60;
      for (; this.owed >= 1; this.owed--) {
        const start = new THREE.Vector3(spread(1.7), 2.5 + Math.random() * 0.3, -1 - Math.random() * 1.5);
        this.confetti.spawn(start, new THREE.Vector3(0, -0.2, 0), {
          color: pick(PARTY),
          life: 4,
          gravity: 0.5,
          drag: 0.9,
          flutter: 1.6,
          size: 1.2,
        });
      }
    }
    for (const pool of this.pools) pool.update(dt);
    for (const ring of this.rings) {
      if (!ring.visible) continue;
      const data = ring.userData;
      data.age += dt;
      const progress = data.age / data.life;
      if (progress >= 1) {
        ring.visible = false;
        continue;
      }
      ring.scale.setScalar(data.size * (0.2 + 0.8 * (1 - (1 - progress) ** 3)));
      ring.material.opacity = 1 - progress;
      ring.lookAt(cameraPosition);
    }
  }
}
