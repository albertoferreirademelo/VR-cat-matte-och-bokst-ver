import * as THREE from 'three';
import { starShape } from './shapes.js';
import { Spring } from './motion.js';

const geometry = new THREE.ShapeGeometry(starShape(0.032, 0.015));
const EMPTY = 0xffffff;
const GOLD = 0xffb703;
const MISSED = 0x9d8ab5;

// One star per question in the round: gold when right, grey when missed.
export class StarRow extends THREE.Group {
  constructor() {
    super();
    this.slots = [];
  }

  reset(count) {
    for (const slot of this.slots) slot.mesh.material.dispose();
    this.clear();
    this.slots = Array.from({ length: count }, (_, i) => {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: EMPTY, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
      );
      mesh.position.x = (i - (count - 1) / 2) * 0.075;
      this.add(mesh);
      return { mesh, size: new Spring(1, 300, 12), gold: false };
    });
  }

  slotPosition(index, target = new THREE.Vector3()) {
    return this.slots[index].mesh.getWorldPosition(target);
  }

  fill(index, right) {
    const slot = this.slots[index];
    slot.mesh.material.color.set(right ? GOLD : MISSED);
    slot.mesh.material.opacity = 1;
    slot.gold = right;
    slot.size.value = right ? 2.4 : 0.5;
  }

  update(dt, t) {
    this.slots.forEach((slot, i) => {
      slot.mesh.scale.setScalar(slot.size.update(dt));
      slot.mesh.rotation.z = slot.gold ? Math.sin(t * 3 + i) * 0.18 : 0;
    });
  }
}
